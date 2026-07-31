-- Corrige los WARN de get_advisors sobre la migracion 0001:
-- 1. search_path mutable en funciones plpgsql (riesgo de search_path hijacking).
-- 2. handle_new_auth_user quedaba invocable como RPC publica (anon/authenticated)
--    pese a ser SECURITY DEFINER y de uso exclusivo del trigger on_auth_user_created.

alter function public.set_audit_fields() set search_path = public;
alter function public.handle_new_auth_user() set search_path = public;
alter function public.validar_transicion_licitacion() set search_path = public;
alter function public.registrar_historial_transicion() set search_path = public;
alter function public.validar_licitacion_editable() set search_path = public;
alter function public.validar_presupuesto_licitacion() set search_path = public;
alter function public.validar_pago() set search_path = public;
alter function public.autocobrar_licitacion() set search_path = public;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
