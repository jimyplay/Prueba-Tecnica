import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { registrarPago } from "@/lib/domain/licitaciones/service";

const registrarPagoSchema = z.object({
  monto: z.number().positive(),
  metodoPago: z.string().optional().nullable(),
  referencia: z.string().optional().nullable(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getSessionUser();
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pagos")
      .select("*")
      .eq("licitacion_id", id)
      .order("fecha_pago", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getSessionUser();
    const { id } = await params;
    const body = registrarPagoSchema.parse(await request.json());

    const supabase = await createClient();
    const data = await registrarPago(supabase, id, body.monto, {
      metodoPago: body.metodoPago,
      referencia: body.referencia,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
