import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, requireAdmin } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";

const createUsuarioSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nombre: z.string().optional().nullable(),
  role: z.enum(["admin", "user"]).default("user"),
});

export async function GET() {
  try {
    await getSessionUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, email, nombre, role, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

// Solo admins pueden crear usuarios. Doble garantia: chequeo de rol aca +
// la tabla `usuarios` no tiene policy de INSERT para `authenticated` (solo
// escribible via service-role), ver migracion 0001_init.sql.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = createUsuarioSchema.parse(await request.json());

    const adminClient = createAdminClient();
    const { data, error } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      app_metadata: {
        role: body.role,
        created_by: admin.id,
      },
      user_metadata: {
        nombre: body.nombre ?? undefined,
      },
    });

    if (error) throw error;
    return NextResponse.json({ data: data.user }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
