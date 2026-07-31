import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { marcarPerdida } from "@/lib/domain/licitaciones/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getSessionUser();
    const { id } = await params;
    const supabase = await createClient();
    const data = await marcarPerdida(supabase, id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
