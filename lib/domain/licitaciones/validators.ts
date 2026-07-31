import { ValidationError } from "@/lib/api/errors";

/** Espeja el trigger `validar_presupuesto_licitacion`. */
export function assertPresupuestoNoExcedido(
  nuevoTotal: number,
  presupuestoMaximo: number
): void {
  if (nuevoTotal > presupuestoMaximo) {
    throw new ValidationError(
      `El total de productos (${nuevoTotal}) supera el presupuesto maximo (${presupuestoMaximo})`
    );
  }
}

/** Espeja el trigger `validar_pago`. */
export function assertPagoValido(monto: number, saldoPendiente: number): void {
  if (monto <= 0) {
    throw new ValidationError("El monto del pago debe ser mayor a 0");
  }
  if (monto > saldoPendiente) {
    throw new ValidationError(
      `El pago (${monto}) supera el saldo pendiente (${saldoPendiente})`
    );
  }
}

export function assertDocumentoPresente(
  documentoUrl: string | null | undefined
): void {
  if (!documentoUrl) {
    throw new ValidationError(
      "No se puede enviar la licitacion sin documento de propuesta adjunto"
    );
  }
}
