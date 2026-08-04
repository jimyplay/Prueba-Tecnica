import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { ConflictError, NotFoundError, ValidationError, handleApiError } from "@/lib/api/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getSessionUser();
    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("Se requiere un archivo en el campo 'file'");
    }

    const supabase = await createClient();

    const { data: licitacion, error: licitacionError } = await supabase
      .from("licitaciones")
      .select("id, estado")
      .eq("id", id)
      .maybeSingle();
    if (licitacionError) throw licitacionError;
    if (!licitacion) throw new NotFoundError("Licitacion no encontrada");
    if (licitacion.estado !== "borrador") {
      throw new ConflictError(
        "El documento de propuesta solo puede subirse mientras la licitacion esta en borrador"
      );
    }

    const path = `${id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("propuestas")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("propuestas").getPublicUrl(path);

    const { data, error } = await supabase
      .from("licitaciones")
      .update({ documento_propuesta_path: path, documento_propuesta_url: publicUrl })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

// Solo mientras esta en borrador: permite quitar el documento adjunto para
// reemplazarlo por otro antes de enviar la licitacion.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getSessionUser();
    const { id } = await params;
    const supabase = await createClient();

    const { data: licitacion, error: licitacionError } = await supabase
      .from("licitaciones")
      .select("id, estado, documento_propuesta_path")
      .eq("id", id)
      .maybeSingle();
    if (licitacionError) throw licitacionError;
    if (!licitacion) throw new NotFoundError("Licitacion no encontrada");
    if (licitacion.estado !== "borrador") {
      throw new ConflictError(
        "El documento de propuesta solo puede eliminarse mientras la licitacion esta en borrador"
      );
    }
    if (!licitacion.documento_propuesta_path) {
      throw new NotFoundError("No hay documento adjunto para eliminar");
    }

    const { error: removeError } = await supabase.storage
      .from("propuestas")
      .remove([licitacion.documento_propuesta_path]);
    if (removeError) throw removeError;

    const { data, error } = await supabase
      .from("licitaciones")
      .update({ documento_propuesta_path: null, documento_propuesta_url: null })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
