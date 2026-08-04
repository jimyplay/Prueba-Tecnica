import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { NotFoundError, handleApiError } from "@/lib/api/errors";

const updateClienteSchema = z.object({
  nombre: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  telefono: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getSessionUser();
    const { id } = await params;
    const body = updateClienteSchema.parse(await request.json());

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("clientes")
      .update(body)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError("Cliente no encontrado");

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
