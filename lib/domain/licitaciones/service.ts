import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import {
  assertEditable,
  assertTransicionValida,
  type EstadoLicitacion,
} from "./state-machine";
import { assertPagoValido, assertPresupuestoNoExcedido } from "./validators";

type Db = SupabaseClient;

export async function crearLicitacion(
  db: Db,
  input: {
    clienteId: string;
    titulo: string;
    descripcion?: string | null;
    presupuestoMaximo: number;
    fechaLimite: string;
  }
) {
  const { data, error } = await db
    .from("licitaciones")
    .insert({
      cliente_id: input.clienteId,
      titulo: input.titulo,
      descripcion: input.descripcion ?? null,
      presupuesto_maximo: input.presupuestoMaximo,
      fecha_limite: input.fechaLimite,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listarLicitaciones(db: Db) {
  const { data, error } = await db
    .from("licitaciones_saldo")
    .select("*, clientes(nombre)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function obtenerLicitacionDetalle(db: Db, id: string) {
  const { data: licitacion, error } = await db
    .from("licitaciones_saldo")
    .select("*, clientes(id, nombre, email)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!licitacion) throw new NotFoundError("Licitacion no encontrada");

  const [{ data: productos }, { data: historial }, { data: pagos }] =
    await Promise.all([
      db
        .from("licitacion_productos")
        .select("id, cantidad, precio, productos(id, nombre, precio_unitario)")
        .eq("licitacion_id", id),
      db
        .from("historial_transiciones")
        .select("id, estado_anterior, estado_nuevo, usuario_id, fecha")
        .eq("licitacion_id", id)
        .order("fecha", { ascending: true }),
      db
        .from("pagos")
        .select("id, monto, fecha_pago, metodo_pago, referencia")
        .eq("licitacion_id", id)
        .order("fecha_pago", { ascending: true }),
    ]);

  return { licitacion, productos: productos ?? [], historial: historial ?? [], pagos: pagos ?? [] };
}

async function getLicitacionOrThrow(db: Db, id: string) {
  const { data, error } = await db
    .from("licitaciones")
    .select("id, estado, presupuesto_maximo, monto_facturado, documento_propuesta_url")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError("Licitacion no encontrada");
  return data;
}

export async function agregarProducto(
  db: Db,
  licitacionId: string,
  input: { productoId: string; cantidad: number }
) {
  const licitacion = await getLicitacionOrThrow(db, licitacionId);
  assertEditable(licitacion.estado as EstadoLicitacion);

  const { data: producto, error: productoError } = await db
    .from("productos")
    .select("id, precio_unitario")
    .eq("id", input.productoId)
    .maybeSingle();
  if (productoError) throw productoError;
  if (!producto) throw new NotFoundError("Producto no encontrado");

  const { data: actuales, error: actualesError } = await db
    .from("licitacion_productos")
    .select("cantidad, precio")
    .eq("licitacion_id", licitacionId);
  if (actualesError) throw actualesError;

  const totalActual = (actuales ?? []).reduce(
    (acc, p) => acc + p.cantidad * Number(p.precio),
    0
  );
  const nuevoTotal =
    totalActual + input.cantidad * Number(producto.precio_unitario);

  assertPresupuestoNoExcedido(nuevoTotal, Number(licitacion.presupuesto_maximo));

  const { data, error } = await db
    .from("licitacion_productos")
    .insert({
      licitacion_id: licitacionId,
      producto_id: input.productoId,
      cantidad: input.cantidad,
      precio: producto.precio_unitario,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function quitarProducto(
  db: Db,
  licitacionId: string,
  licitacionProductoId: string
) {
  const licitacion = await getLicitacionOrThrow(db, licitacionId);
  assertEditable(licitacion.estado as EstadoLicitacion);

  const { error } = await db
    .from("licitacion_productos")
    .delete()
    .eq("id", licitacionProductoId)
    .eq("licitacion_id", licitacionId);

  if (error) throw error;
}

async function cambiarEstado(db: Db, id: string, nuevoEstado: EstadoLicitacion, extra: Record<string, unknown> = {}) {
  const licitacion = await getLicitacionOrThrow(db, id);
  assertTransicionValida(licitacion.estado as EstadoLicitacion, nuevoEstado);

  const { data, error } = await db
    .from("licitaciones")
    .update({ estado: nuevoEstado, ...extra })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Usado por la ruta `enviar` DESPUES de confirmar el envio real del email. */
export async function marcarEnviada(db: Db, id: string) {
  return cambiarEstado(db, id, "activa");
}

export async function marcarFinalizada(db: Db, id: string) {
  return cambiarEstado(db, id, "finalizada");
}

export async function marcarPerdida(db: Db, id: string) {
  return cambiarEstado(db, id, "perdida");
}

export async function facturar(db: Db, id: string) {
  const { data: productos, error: productosError } = await db
    .from("licitacion_productos")
    .select("cantidad, precio")
    .eq("licitacion_id", id);
  if (productosError) throw productosError;

  const montoFacturado = (productos ?? []).reduce(
    (acc, p) => acc + p.cantidad * Number(p.precio),
    0
  );

  return cambiarEstado(db, id, "por_cobrar", { monto_facturado: montoFacturado });
}

export async function registrarPago(
  db: Db,
  licitacionId: string,
  monto: number,
  extra: { metodoPago?: string | null; referencia?: string | null } = {}
) {
  const licitacion = await getLicitacionOrThrow(db, licitacionId);
  if (licitacion.estado !== "por_cobrar") {
    throw new ValidationError(
      `Solo se pueden registrar pagos cuando la licitacion esta en estado por_cobrar (actual: ${licitacion.estado})`
    );
  }

  const { data: pagosPrevios, error: pagosError } = await db
    .from("pagos")
    .select("monto")
    .eq("licitacion_id", licitacionId);
  if (pagosError) throw pagosError;

  const totalPagado = (pagosPrevios ?? []).reduce(
    (acc, p) => acc + Number(p.monto),
    0
  );
  const saldoPendiente = Number(licitacion.monto_facturado ?? 0) - totalPagado;

  assertPagoValido(monto, saldoPendiente);

  const { data, error } = await db
    .from("pagos")
    .insert({
      licitacion_id: licitacionId,
      monto,
      metodo_pago: extra.metodoPago ?? null,
      referencia: extra.referencia ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
