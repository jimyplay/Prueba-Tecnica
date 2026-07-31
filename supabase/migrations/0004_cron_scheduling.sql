-- Tarea programada para vencimiento automatico y recordatorio de licitaciones.
-- pg_net.http_post llama directamente a la API de Resend desde SQL (sin Edge
-- Function), ya que el recordatorio no lleva adjunto. La API key de Resend se
-- lee de Supabase Vault (secret 'resend_api_key') - debe crearse por separado
-- con: select vault.create_secret('<key>', 'resend_api_key');
-- una vez se disponga de una cuenta real de Resend.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Vencimiento automatico: activa -> perdida si paso la fecha_limite.
create or replace function public.expirar_licitaciones_vencidas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.licitaciones
  set estado = 'perdida'
  where estado = 'activa' and fecha_limite < now();
end;
$$;

-- Recordatorio: activa, <48h para vencer, aun no enviado. Envio "fire and
-- forget" via pg_net; reminder_sent_at se marca de forma optimista (no se
-- espera la respuesta HTTP de Resend antes de marcarlo).
create or replace function public.enviar_recordatorios_vencimiento()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  resend_key text;
begin
  select decrypted_secret into resend_key
  from vault.decrypted_secrets where name = 'resend_api_key';

  if resend_key is null then
    raise notice 'resend_api_key no configurada en Vault, se omite el envio de recordatorios';
    return;
  end if;

  for rec in
    select l.id, l.titulo, l.fecha_limite, c.nombre as cliente_nombre, c.email as cliente_email
    from public.licitaciones l
    join public.clientes c on c.id = l.cliente_id
    where l.estado = 'activa'
      and l.reminder_sent_at is null
      and l.fecha_limite between now() and now() + interval '48 hours'
      and c.email is not null
  loop
    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || resend_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', 'Licitaciones <onboarding@resend.dev>',
        'to', jsonb_build_array(rec.cliente_email),
        'subject', 'Recordatorio: fecha limite proxima - ' || rec.titulo,
        'html', '<p>Hola ' || coalesce(rec.cliente_nombre, '') || ',</p>' ||
                '<p>La licitacion "' || rec.titulo || '" vence el ' ||
                to_char(rec.fecha_limite, 'DD/MM/YYYY HH24:MI') || '.</p>'
      )
    );

    update public.licitaciones set reminder_sent_at = now() where id = rec.id;
  end loop;
end;
$$;

revoke execute on function public.expirar_licitaciones_vencidas() from public, anon, authenticated;
revoke execute on function public.enviar_recordatorios_vencimiento() from public, anon, authenticated;

select cron.schedule(
  'expirar-licitaciones-vencidas',
  '*/15 * * * *',
  $$select public.expirar_licitaciones_vencidas();$$
);

select cron.schedule(
  'enviar-recordatorios-vencimiento',
  '*/15 * * * *',
  $$select public.enviar_recordatorios_vencimiento();$$
);
