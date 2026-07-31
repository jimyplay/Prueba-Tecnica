import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";

const createProductoSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().optional().nullable(),
  precioUnitario: z.number().nonnegative(),
});

export async function GET() {
  try {
    await getSessionUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await getSessionUser();
    const body = createProductoSchema.parse(await request.json());

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("productos")
      .insert({
        nombre: body.nombre,
        descripcion: body.descripcion ?? null,
        precio_unitario: body.precioUnitario,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
