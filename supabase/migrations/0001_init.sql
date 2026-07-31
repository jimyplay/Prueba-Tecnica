-- Sistema de Gestion de Licitaciones - esquema inicial
-- Tablas, triggers (maquina de estados + reglas de negocio), vista de saldo, RLS.

-- =========================================================================
-- 1. TABLAS
-- =========================================================================

create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text,
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios(id),
  updated_at timestamptz not null default now(),
  modified_by uuid references public.usuarios(id)
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text,
  telefono text,
  direccion text,
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  modified_by uuid references public.usuarios(id)
);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  modified_by uuid references public.usuarios(id)
);

create table public.licitaciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id),
  titulo text not null,
  descripcion text,
  presupuesto_maximo numeric(12,2) not null check (presupuesto_maximo > 0),
  fecha_limite timestamptz not null,
  estado text not null default 'borrador'
    check (estado in ('borrador','activa','finalizada','por_cobrar','cobrada','perdida')),
  documento_propuesta_path text,
  documento_propuesta_url text,
  monto_facturado numeric(12,2),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios(id) default auth.uid(),
  updated_at timestamptz not null default now(),
  modified_by uuid references public.usuarios(id)
);

create table public.licitacion_productos (
  id uuid primary key default gen_random_uuid(),
  licitacion_id uuid not null references public.licitaciones(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  cantidad integer not null check (cantidad > 0),
  precio numeric(12,2) not null check (precio >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios(id) default auth.uid(),
  unique (licitacion_id, producto_id)
);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  licitacion_id uuid not null references public.licitaciones(id) on delete cascade,
  monto numeric(12,2) not null check (monto > 0),
  fecha_pago timestamptz not null default now(),
  metodo_pago text,
  referencia text,
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios(id) default auth.uid()
);

create table public.historial_transiciones (
  id uuid primary key default gen_random_uuid(),
  licitacion_id uuid not null references public.licitaciones(id) on delete cascade,
  estado_anterior text,
  estado_nuevo text not null,
  usuario_id uuid references public.usuarios(id),
  detalle text,
  fecha timestamptz not null default now()
);

create index on public.licitaciones (cliente_id);
create index on public.licitaciones (estado);
create index on public.licitacion_productos (licitacion_id);
create index on public.pagos (licitacion_id);
create index on public.historial_transiciones (licitacion_id);

-- =========================================================================
-- 2. VISTA DE SALDO (nunca almacenado, siempre calculado)
-- =========================================================================

create view public.licitaciones_saldo
with (security_invoker = true) as
select
  l.*,
  l.monto_facturado - coalesce(p.total_pagado, 0) as saldo_pendiente
from public.licitaciones l
left join (
  select licitacion_id, sum(monto) as total_pagado
  from public.pagos
  group by licitacion_id
) p on p.licitacion_id = l.id;

-- =========================================================================
-- 3. FUNCIONES DE SOPORTE (auditoria + sync auth.users)
-- =========================================================================

create or replace function public.set_audit_fields()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.modified_by = auth.uid();
  return new;
end;
$$;

create trigger trg_audit
  before update on public.usuarios
  for each row execute function public.set_audit_fields();
create trigger trg_audit
  before update on public.clientes
  for each row execute function public.set_audit_fields();
create trigger trg_audit
  before update on public.productos
  for each row execute function public.set_audit_fields();
create trigger trg_audit
  before update on public.licitaciones
  for each row execute function public.set_audit_fields();

-- Sincroniza auth.users -> public.usuarios. El rol y quien lo creo viajan en
-- app_metadata (nunca en user_metadata, que es editable por el propio usuario).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, email, nombre, role, created_by)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'nombre',
    coalesce(new.raw_app_meta_data ->> 'role', 'user'),
    nullif(new.raw_app_meta_data ->> 'created_by', '')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- =========================================================================
-- 4. MAQUINA DE ESTADOS DE LICITACION (fuente de verdad)
-- =========================================================================

create or replace function public.validar_transicion_licitacion()
returns trigger
language plpgsql
as $$
declare
  es_valida boolean := false;
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  if (old.estado, new.estado) in (
    ('borrador', 'activa'),
    ('activa', 'finalizada'),
    ('activa', 'perdida'),
    ('finalizada', 'por_cobrar'),
    ('por_cobrar', 'cobrada')
  ) then
    es_valida := true;
  end if;

  if not es_valida then
    raise exception 'Transicion de estado invalida: % -> %', old.estado, new.estado
      using errcode = '22023';
  end if;

  if old.estado = 'borrador' and new.estado = 'activa' and new.documento_propuesta_url is null then
    raise exception 'No se puede enviar la licitacion sin documento de propuesta adjunto'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger trg_validar_transicion
  before update of estado on public.licitaciones
  for each row execute function public.validar_transicion_licitacion();

create or replace function public.registrar_historial_transicion()
returns trigger
language plpgsql
as $$
begin
  if new.estado is distinct from old.estado then
    insert into public.historial_transiciones (licitacion_id, estado_anterior, estado_nuevo, usuario_id)
    values (new.id, old.estado, new.estado, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_historial_transicion
  after update of estado on public.licitaciones
  for each row execute function public.registrar_historial_transicion();

-- =========================================================================
-- 5. REGLAS DE NEGOCIO: productos (bloqueo + presupuesto)
-- =========================================================================

create or replace function public.validar_licitacion_editable()
returns trigger
language plpgsql
as $$
declare
  v_licitacion_id uuid;
  v_estado text;
begin
  v_licitacion_id := coalesce(new.licitacion_id, old.licitacion_id);
  select estado into v_estado from public.licitaciones where id = v_licitacion_id;

  if v_estado in ('finalizada', 'por_cobrar', 'cobrada', 'perdida') then
    raise exception 'No se pueden modificar productos de una licitacion en estado %', v_estado
      using errcode = '22023';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_licitacion_productos_lock
  before insert or update or delete on public.licitacion_productos
  for each row execute function public.validar_licitacion_editable();

create or replace function public.validar_presupuesto_licitacion()
returns trigger
language plpgsql
as $$
declare
  v_licitacion_id uuid;
  v_total numeric(12,2);
  v_presupuesto numeric(12,2);
begin
  v_licitacion_id := coalesce(new.licitacion_id, old.licitacion_id);

  select coalesce(sum(cantidad * precio), 0) into v_total
  from public.licitacion_productos
  where licitacion_id = v_licitacion_id;

  select presupuesto_maximo into v_presupuesto
  from public.licitaciones where id = v_licitacion_id;

  if v_total > v_presupuesto then
    raise exception 'El total de productos (%) supera el presupuesto maximo (%)', v_total, v_presupuesto
      using errcode = '22023';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_licitacion_productos_presupuesto
  after insert or update on public.licitacion_productos
  for each row execute function public.validar_presupuesto_licitacion();

-- =========================================================================
-- 6. REGLAS DE NEGOCIO: pagos (validacion + auto-cobro)
-- =========================================================================

create or replace function public.validar_pago()
returns trigger
language plpgsql
as $$
declare
  v_estado text;
  v_saldo numeric(12,2);
begin
  select estado, monto_facturado - coalesce((
    select sum(monto) from public.pagos where licitacion_id = new.licitacion_id
  ), 0)
  into v_estado, v_saldo
  from public.licitaciones where id = new.licitacion_id;

  if v_estado <> 'por_cobrar' then
    raise exception 'Solo se pueden registrar pagos cuando la licitacion esta en estado por_cobrar (actual: %)', v_estado
      using errcode = '22023';
  end if;

  if new.monto > v_saldo then
    raise exception 'El pago (%) supera el saldo pendiente (%)', new.monto, v_saldo
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger trg_validar_pago
  before insert on public.pagos
  for each row execute function public.validar_pago();

create or replace function public.autocobrar_licitacion()
returns trigger
language plpgsql
as $$
declare
  v_saldo numeric(12,2);
begin
  select monto_facturado - coalesce(sum(monto), 0) into v_saldo
  from public.pagos where licitacion_id = new.licitacion_id;

  if v_saldo <= 0 then
    update public.licitaciones set estado = 'cobrada'
    where id = new.licitacion_id and estado = 'por_cobrar';
  end if;

  return new;
end;
$$;

create trigger trg_autocobrar
  after insert on public.pagos
  for each row execute function public.autocobrar_licitacion();

-- =========================================================================
-- 7. RLS
-- =========================================================================

alter table public.usuarios enable row level security;
alter table public.clientes enable row level security;
alter table public.productos enable row level security;
alter table public.licitaciones enable row level security;
alter table public.licitacion_productos enable row level security;
alter table public.pagos enable row level security;
alter table public.historial_transiciones enable row level security;

-- usuarios: solo lectura para authenticated. Escritura unicamente via
-- cliente service-role (bypassa RLS) -> "solo admins crean usuarios" es
-- garantia de base de datos, no solo de la app.
create policy "usuarios_select" on public.usuarios
  for select to authenticated using (true);

-- App interna de un solo tenant, sin ownership por fila (documentado como
-- simplificacion deliberada en el README). Las reglas de negocio reales
-- viven en los triggers de arriba, no en RLS.
create policy "clientes_select" on public.clientes
  for select to authenticated using (true);
create policy "clientes_insert" on public.clientes
  for insert to authenticated with check (true);
create policy "clientes_update" on public.clientes
  for update to authenticated using (true) with check (true);

create policy "productos_select" on public.productos
  for select to authenticated using (true);
create policy "productos_insert" on public.productos
  for insert to authenticated with check (true);
create policy "productos_update" on public.productos
  for update to authenticated using (true) with check (true);

create policy "licitaciones_select" on public.licitaciones
  for select to authenticated using (true);
create policy "licitaciones_insert" on public.licitaciones
  for insert to authenticated with check (true);
create policy "licitaciones_update" on public.licitaciones
  for update to authenticated using (true) with check (true);

create policy "licitacion_productos_select" on public.licitacion_productos
  for select to authenticated using (true);
create policy "licitacion_productos_insert" on public.licitacion_productos
  for insert to authenticated with check (true);
create policy "licitacion_productos_delete" on public.licitacion_productos
  for delete to authenticated using (true);

create policy "pagos_select" on public.pagos
  for select to authenticated using (true);
create policy "pagos_insert" on public.pagos
  for insert to authenticated with check (true);

create policy "historial_select" on public.historial_transiciones
  for select to authenticated using (true);
create policy "historial_insert" on public.historial_transiciones
  for insert to authenticated with check (true);
