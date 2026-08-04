"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Producto = { id: string; nombre: string; precio_unitario: number };
type LicitacionProducto = {
  id: string;
  cantidad: number;
  precio: number;
  productos: Producto | Producto[] | null;
};
type Historial = {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  usuario_id: string | null;
  fecha: string;
};
type Pago = { id: string; monto: number; fecha_pago: string };
type Cliente = { id: string; nombre: string; email: string | null };
type LicitacionDetalle = {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  presupuesto_maximo: number;
  fecha_limite: string;
  monto_facturado: number | null;
  saldo_pendiente: number | null;
  documento_propuesta_url: string | null;
  clientes: Cliente | Cliente[] | null;
};

const ESTADO_LABELS: Record<string, string> = {
  borrador: "Borrador",
  activa: "Activa",
  finalizada: "Finalizada",
  por_cobrar: "Por cobrar",
  cobrada: "Cobrada",
  perdida: "Perdida",
};

function unwrap<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default function LicitacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [licitacion, setLicitacion] = useState<LicitacionDetalle | null>(null);
  const [productosLicitacion, setProductosLicitacion] = useState<LicitacionProducto[]>([]);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [catalogoProductos, setCatalogoProductos] = useState<Producto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [montoPago, setMontoPago] = useState("");

  async function cargar() {
    const res = await fetch(`/api/licitaciones/${id}`);
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "No se pudo cargar la licitación");
      return;
    }
    setLicitacion(body.data.licitacion);
    setProductosLicitacion(body.data.productos ?? []);
    setHistorial(body.data.historial ?? []);
    setPagos(body.data.pagos ?? []);
  }

  useEffect(() => {
    cargar();
    fetch("/api/productos")
      .then((res) => res.json())
      .then(({ data }) => setCatalogoProductos(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function ejecutar(accion: () => Promise<Response>) {
    setError(null);
    setBusy(true);
    const res = await accion();
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Ocurrió un error");
      return false;
    }
    await cargar();
    return true;
  }

  // El archivo va DIRECTO del navegador a Supabase Storage: las funciones
  // serverless de Vercel rechazan cualquier request de mas de ~4.5MB antes
  // de que nuestro codigo la vea (FUNCTION_PAYLOAD_TOO_LARGE), asi que un
  // PDF real nunca puede pasar por nuestra propia API. Solo el path final
  // se manda al backend para que valide la regla de negocio y lo registre.
  async function subirDocumento() {
    if (!archivo) return;
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const path = `${id}/${Date.now()}-${archivo.name}`;
    const { error: uploadError } = await supabase.storage
      .from("propuestas")
      .upload(path, archivo, { contentType: archivo.type });

    if (uploadError) {
      setBusy(false);
      setError(uploadError.message);
      return;
    }

    const ok = await ejecutar(() =>
      fetch(`/api/licitaciones/${id}/documento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      })
    );
    if (ok) setArchivo(null);
  }

  if (!licitacion) {
    return <p className="text-sm text-gray-500">{error ?? "Cargando..."}</p>;
  }

  const cliente = unwrap(licitacion.clientes);
  const editable = !["finalizada", "por_cobrar", "cobrada", "perdida"].includes(
    licitacion.estado
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{licitacion.titulo}</h1>
        <p className="text-sm text-gray-500">
          Cliente: {cliente?.nombre} · Estado:{" "}
          <span className="font-medium">
            {ESTADO_LABELS[licitacion.estado] ?? licitacion.estado}
          </span>
        </p>
        <p className="text-sm text-gray-500">
          Presupuesto máximo: ${Number(licitacion.presupuesto_maximo).toFixed(2)} · Fecha
          límite: {new Date(licitacion.fecha_limite).toLocaleString("es")}
        </p>
        {licitacion.monto_facturado != null && (
          <p className="text-sm text-gray-500">
            Facturado: ${Number(licitacion.monto_facturado).toFixed(2)} · Saldo pendiente: $
            {Number(licitacion.saldo_pendiente ?? 0).toFixed(2)}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Documento de propuesta */}
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-medium text-gray-900">Documento de propuesta</h2>
        {licitacion.documento_propuesta_url ? (
          <div className="flex items-center gap-3">
            <a
              href={licitacion.documento_propuesta_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              Ver documento adjunto
            </a>
            {licitacion.estado === "borrador" && (
              <button
                disabled={busy}
                onClick={() =>
                  ejecutar(() =>
                    fetch(`/api/licitaciones/${id}/documento`, { method: "DELETE" })
                  )
                }
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                Quitar
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Sin documento adjunto.</p>
        )}
        {licitacion.estado === "borrador" && !licitacion.documento_propuesta_url && (
          <div className="flex items-center gap-3">
            <input
              type="file"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <button
              disabled={!archivo || busy}
              onClick={subirDocumento}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {busy ? "Subiendo..." : "Subir"}
            </button>
          </div>
        )}
      </section>

      {/* Acciones de transicion */}
      <section className="flex flex-wrap gap-3">
        {licitacion.estado === "borrador" && (
          <button
            disabled={busy || !licitacion.documento_propuesta_url}
            onClick={() =>
              ejecutar(() => fetch(`/api/licitaciones/${id}/enviar`, { method: "POST" }))
            }
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Enviar al cliente
          </button>
        )}
        {licitacion.estado === "activa" && (
          <>
            <button
              disabled={busy}
              onClick={() =>
                ejecutar(() =>
                  fetch(`/api/licitaciones/${id}/finalizar`, { method: "POST" })
                )
              }
              className="rounded-md bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Marcar finalizada (ganada)
            </button>
            <button
              disabled={busy}
              onClick={() =>
                ejecutar(() => fetch(`/api/licitaciones/${id}/perder`, { method: "POST" }))
              }
              className="rounded-md bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Marcar perdida
            </button>
          </>
        )}
        {licitacion.estado === "finalizada" && (
          <button
            disabled={busy}
            onClick={() =>
              ejecutar(() => fetch(`/api/licitaciones/${id}/facturar`, { method: "POST" }))
            }
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Facturar (pasar a por cobrar)
          </button>
        )}
      </section>

      {/* Productos */}
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-medium text-gray-900">Productos</h2>
        <ul className="divide-y divide-gray-200">
          {productosLicitacion.map((lp) => {
            const producto = unwrap(lp.productos);
            return (
              <li key={lp.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {producto?.nombre} · {lp.cantidad} x ${Number(lp.precio).toFixed(2)} = $
                  {(lp.cantidad * Number(lp.precio)).toFixed(2)}
                </span>
                {editable && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      ejecutar(() =>
                        fetch(`/api/licitaciones/${id}/productos/${lp.id}`, {
                          method: "DELETE",
                        })
                      )
                    }
                    className="text-xs text-red-600 hover:underline"
                  >
                    Quitar
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {editable && (
          <div className="flex items-end gap-3 border-t border-gray-100 pt-3">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-800">Producto</label>
              <select
                value={productoId}
                onChange={(e) => setProductoId(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              >
                <option value="">Seleccioná</option>
                {catalogoProductos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (${Number(p.precio_unitario).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-800">Cantidad</label>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <button
              disabled={!productoId || busy}
              onClick={() =>
                ejecutar(() =>
                  fetch(`/api/licitaciones/${id}/productos`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      productoId,
                      cantidad: Number(cantidad),
                    }),
                  })
                )
              }
              className="rounded-md bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        )}
      </section>

      {/* Pagos */}
      {licitacion.estado === "por_cobrar" || pagos.length > 0 ? (
        <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="font-medium text-gray-900">Pagos</h2>
          <ul className="divide-y divide-gray-200 text-sm">
            {pagos.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>{new Date(p.fecha_pago).toLocaleString("es")}</span>
                <span>${Number(p.monto).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          {licitacion.estado === "por_cobrar" && (
            <div className="flex items-end gap-3 border-t border-gray-100 pt-3">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-800">Monto</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <button
                disabled={!montoPago || busy}
                onClick={async () => {
                  const ok = await ejecutar(() =>
                    fetch(`/api/licitaciones/${id}/pagos`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ monto: Number(montoPago) }),
                    })
                  );
                  if (ok) setMontoPago("");
                }}
                className="rounded-md bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                Registrar pago
              </button>
            </div>
          )}
        </section>
      ) : null}

      {/* Historial */}
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-medium text-gray-900">Historial de transiciones</h2>
        <ul className="space-y-1 text-sm text-gray-600">
          {historial.map((h) => (
            <li key={h.id}>
              {new Date(h.fecha).toLocaleString("es")} —{" "}
              {h.estado_anterior ? `${h.estado_anterior} → ` : ""}
              {h.estado_nuevo} {h.usuario_id ? "" : "(sistema)"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
