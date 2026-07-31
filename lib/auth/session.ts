import { createClient } from "@/lib/supabase/server";

export class AuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type SessionUser = {
  id: string;
  email: string;
  nombre: string | null;
  role: "admin" | "user";
};

/** Lanza AuthError(401) si no hay sesion valida. */
export async function getSessionUser(): Promise<SessionUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError(401, "No autenticado");
  }

  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("id, email, nombre, role")
    .eq("id", user.id)
    .single();

  if (error || !usuario) {
    throw new AuthError(401, "Usuario no encontrado");
  }

  return usuario as SessionUser;
}

/** Lanza AuthError(401)/(403) si no hay sesion o el usuario no es admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const usuario = await getSessionUser();
  if (usuario.role !== "admin") {
    throw new AuthError(403, "Esta accion requiere rol admin");
  }
  return usuario;
}
