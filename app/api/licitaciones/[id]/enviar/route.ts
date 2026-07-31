import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { ConflictError, ValidationError, handleApiError } from "@/lib/api/errors";
import { assertDocumentoPresente } from "@/lib/domain/licitaciones/validators";
import { assertTransicionValida } from "@/lib/domain/licitaciones/state-machine";
import { marcarEnviada, obtenerLicitacionDetalle } from "@/lib/domain/licitaciones/service";
import { getResendClient } from "@/lib/email/resend";
import { licitacionEnviadaHtml } from "@/lib/email/templates/licitacion-enviada";

// borrador -> activa: valida documento, envia el email real con adjunto y
// SOLO transiciona el estado si el envio tuvo exito (si Resend falla, la
// licitacion se queda en borrador para reintentar).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getSessionUser();
    const { id } = await params;
    const supabase = await createClient();

    const { licitacion, productos } = await obtenerLicitacionDetalle(supabase, id);

    assertTransicionValida(licitacion.estado, "activa");
    assertDocumentoPresente(licitacion.documento_propuesta_url);

    const cliente = licitacion.clientes;
    if (!cliente?.email) {
      throw new ValidationError("El cliente no tiene email configurado");
    }

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("propuestas")
      .download(licitacion.documento_propuesta_path);
    if (downloadError) throw downloadError;

    const attachmentBuffer = Buffer.from(await fileBlob.arrayBuffer());
    const filename =
      licitacion.documento_propuesta_path.split("/").pop() ?? "propuesta.pdf";

    const resend = getResendClient();
    const { error: emailError } = await resend.emails.send({
      from: "Licitaciones <onboarding@resend.dev>",
      to: [cliente.email],
      subject: `Licitación enviada: ${licitacion.titulo}`,
      html: licitacionEnviadaHtml({
        clienteNombre: cliente.nombre ?? cliente.email,
        titulo: licitacion.titulo,
        presupuestoMaximo: Number(licitacion.presupuesto_maximo),
        fechaLimite: licitacion.fecha_limite,
        productos: productos.map((p) => {
          // El cliente de Supabase sin tipos generados infiere el join
          // producto_id -> productos como array; en runtime PostgREST
          // devuelve un solo objeto (relacion N:1).
          const producto = Array.isArray(p.productos) ? p.productos[0] : p.productos;
          return {
            nombre: producto?.nombre ?? "",
            cantidad: p.cantidad,
            precio: Number(p.precio),
          };
        }),
      }),
      attachments: [{ filename, content: attachmentBuffer }],
    });

    if (emailError) {
      throw new ConflictError(`No se pudo enviar el email: ${emailError.message}`);
    }

    const data = await marcarEnviada(supabase, id);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
