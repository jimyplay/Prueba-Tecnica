-- Fix: autocobrar_licitacion() referenciaba monto_facturado como si fuera
-- columna de public.pagos (donde no existe) en vez de public.licitaciones.
-- Descubierto al probar el flujo de pagos con execute_sql tras 0001_init.

create or replace function public.autocobrar_licitacion()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_saldo numeric(12,2);
begin
  select l.monto_facturado - coalesce(sum(p.monto), 0) into v_saldo
  from public.licitaciones l
  left join public.pagos p on p.licitacion_id = l.id
  where l.id = new.licitacion_id
  group by l.monto_facturado;

  if v_saldo <= 0 then
    update public.licitaciones set estado = 'cobrada'
    where id = new.licitacion_id and estado = 'por_cobrar';
  end if;

  return new;
end;
$$;
