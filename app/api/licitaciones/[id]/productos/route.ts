import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { agregarProducto } from "@/lib/domain/licitaciones/service";

const addProductoSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: z.number().int().positive(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getSessionUser();
    const { id } = await params;
    const body = addProductoSchema.parse(await request.json());

    const supabase = await createClient();
    const data = await agregarProducto(supabase, id, body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
