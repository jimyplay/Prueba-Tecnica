import { createClient } from "@supabase/supabase-js";

/**
 * Cliente service-role: bypassa RLS. Server-only, nunca importar desde
 * codigo que se ejecute en el navegador. Se usa para operaciones que solo
 * el backend debe poder hacer (crear usuarios de Auth como admin, etc.).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
