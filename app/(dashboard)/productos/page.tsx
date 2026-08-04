"use client";

import { useEffect, useState } from "react";

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_unitario: number;
};

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function cargar() {
    const res = await fetch("/api/productos");
    const { data } = await res.json();
    setProductos(data ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        descripcion: descripcion || null,
        precioUnitario: Number(precio),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Error al crear el producto");
      return;
    }

    setNombre("");
    setDescripcion("");
    setPrecio("");
    cargar();
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-gray-900">Productos</h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-800">Nombre</label>
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-800">Descripción</label>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-800">Precio unitario</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Agregar
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {productos.map((p) => (
          <li key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-gray-900">{p.nombre}</p>
              <p className="text-sm text-gray-500">{p.descripcion ?? "sin descripción"}</p>
            </div>
            <p className="text-sm font-medium text-gray-900">
              ${Number(p.precio_unitario).toFixed(2)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
