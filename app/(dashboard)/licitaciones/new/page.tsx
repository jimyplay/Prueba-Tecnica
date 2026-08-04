"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Cliente = { id: string; nombre: string };

export default function NuevaLicitacionPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [presupuesto, setPresupuesto] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/clientes")
      .then((res) => res.json())
      .then(({ data }) => setClientes(data ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/licitaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId,
        titulo,
        descripcion: descripcion || null,
        presupuestoMaximo: Number(presupuesto),
        fechaLimite: new Date(fechaLimite).toISOString(),
      }),
    });

    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Error al crear la licitación");
      return;
    }

    router.push(`/licitaciones/${body.data.id}`);
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Nueva licitación</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-gray-200 bg-white p-6"
      >
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-800">Cliente</label>
          <select
            required
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Seleccioná un cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-800">Título</label>
          <input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-800">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-800">Presupuesto máximo</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={presupuesto}
            onChange={(e) => setPresupuesto(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-800">Fecha límite</label>
          <input
            required
            type="datetime-local"
            value={fechaLimite}
            onChange={(e) => setFechaLimite(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Crear (borrador)
        </button>
      </form>
    </div>
  );
}
