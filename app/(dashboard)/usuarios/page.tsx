"use client";

import { useEffect, useState } from "react";

type Usuario = {
  id: string;
  email: string;
  nombre: string | null;
  role: "admin" | "user";
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function cargar() {
    const res = await fetch("/api/usuarios");
    const { data } = await res.json();
    setUsuarios(data ?? []);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, nombre: nombre || null, role }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Error al crear el usuario");
      return;
    }

    setEmail("");
    setPassword("");
    setNombre("");
    setRole("user");
    cargar();
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-gray-900">Usuarios</h1>
      <p className="text-sm text-gray-500">
        Solo los administradores pueden crear nuevos usuarios (esta pantalla es
        visible solo para admins; el backend también lo exige).
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="space-y-1">
          <label className="text-sm text-gray-700">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-gray-700">Contraseña</label>
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-gray-700">Nombre</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-gray-700">Rol</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "user")}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Crear usuario
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {usuarios.map((u) => (
          <li key={u.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-gray-900">{u.nombre ?? u.email}</p>
              <p className="text-sm text-gray-500">{u.email}</p>
            </div>
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
              {u.role}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
