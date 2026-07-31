import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { crearLicitacion, listarLicitaciones } from "@/lib/domain/licitaciones/service";

const createLicitacionSchema = z.object({
  clienteId: z.string().uuid(),
  titulo: z.string().min(1),
  descripcion: z.string().optional().nullable(),
  presupuestoMaximo: z.number().positive(),
  fechaLimite: z.string().datetime({ offset: true }).or(z.string().min(1)),
});

export async function GET() {
  try {
    await getSessionUser();
    const supabase = await createClient();
    const data = await listarLicitaciones(supabase);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await getSessionUser();
    const body = createLicitacionSchema.parse(await request.json());

    const supabase = await createClient();
    const data = await crearLicitacion(supabase, body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
