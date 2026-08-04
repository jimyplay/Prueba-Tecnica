-- Gap encontrado probando el flujo real: si una licitacion se factura con
-- monto_facturado = 0 (ej. se facturo sin haber cargado productos), el
-- saldo pendiente ya es $0 desde el arranque, pero la unica logica de
-- auto-cobro vivia en el trigger AFTER INSERT de pagos - nunca se dispara
-- si no hay ningun pago que registrar. La licitacion quedaba trabada para
-- siempre en por_cobrar (no se puede registrar un pago de $0, el trigger
-- validar_pago lo rechaza por monto <= 0).
--
-- Regla del enunciado: "al llegar el saldo a cero, la licitacion pasa
-- automaticamente a cobrada" - un facturado de $0 ya cumple esa condicion
-- sin necesidad de ningun pago.

create or replace function public.autocobrar_si_facturado_cero()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estado = 'por_cobrar' and coalesce(new.monto_facturado, 0) <= 0 then
    update public.licitaciones set estado = 'cobrada'
    where id = new.id and estado = 'por_cobrar';
  end if;
  return new;
end;
$$;

create trigger trg_autocobrar_facturado_cero
  after update of estado on public.licitaciones
  for each row execute function public.autocobrar_si_facturado_cero();
