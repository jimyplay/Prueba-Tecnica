"use client";

import { useEffect, useState } from "react";

type Cliente = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTelefono, setEditTelefono] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  async function cargar() {
    const res = await fetch("/api/clientes");
    const { data } = await res.json();
    setClientes(data ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        email: email || null,
        telefono: telefono || null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Error al crear el cliente");
      return;
    }

    setNombre("");
    setEmail("");
    setTelefono("");
    cargar();
  }

  function empezarEdicion(c: Cliente) {
    setEditandoId(c.id);
    setEditNombre(c.nombre);
    setEditEmail(c.email ?? "");
    setEditTelefono(c.telefono ?? "");
    setEditError(null);
  }

  async function guardarEdicion(id: string) {
    setEditError(null);
    setEditLoading(true);

    const res = await fetch(`/api/clientes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: editNombre,
        email: editEmail || null,
        telefono: editTelefono || null,
      }),
    });

    const body = await res.json().catch(() => ({}));
    setEditLoading(false);

    if (!res.ok) {
      setEditError(body.error ?? "Error al actualizar el cliente");
      return;
    }

    setEditandoId(null);
    cargar();
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-gray-900">Clientes</h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="space-y-1">
          <label className="text-sm text-gray-700">Nombre</label>
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-gray-700">Teléfono</label>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
        {clientes.map((c) =>
          editandoId === c.id ? (
            <li key={c.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <input
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  placeholder="Nombre"
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Email"
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  value={editTelefono}
                  onChange={(e) => setEditTelefono(e.target.value)}
                  placeholder="Teléfono"
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <button
                  disabled={editLoading}
                  onClick={() => guardarEdicion(c.id)}
                  className="rounded-md bg-gray-900 px-3 py-1 text-xs text-white disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  disabled={editLoading}
                  onClick={() => setEditandoId(null)}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-700"
                >
                  Cancelar
                </button>
              </div>
              {editError && <p className="text-xs text-red-600">{editError}</p>}
            </li>
          ) : (
            <li key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-gray-900">{c.nombre}</p>
                <p className="text-sm text-gray-500">
                  {c.email ?? "sin email"} · {c.telefono ?? "sin teléfono"}
                </p>
              </div>
              <button
                onClick={() => empezarEdicion(c)}
                className="text-xs text-blue-600 hover:underline"
              >
                Editar
              </button>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
