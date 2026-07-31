"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Licitacion = {
  id: string;
  titulo: string;
  estado: string;
  fecha_limite: string;
  presupuesto_maximo: number;
  saldo_pendiente: number | null;
  clientes: { nombre: string } | { nombre: string }[] | null;
};

const ESTADO_LABELS: Record<string, string> = {
  borrador: "Borrador",
  activa: "Activa",
  finalizada: "Finalizada",
  por_cobrar: "Por cobrar",
  cobrada: "Cobrada",
  perdida: "Perdida",
};

export default function LicitacionesPage() {
  const [licitaciones, setLicitaciones] = useState<Licitacion[]>([]);

  useEffect(() => {
    fetch("/api/licitaciones")
      .then((res) => res.json())
      .then(({ data }) => setLicitaciones(data ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Licitaciones</h1>
        <Link
          href="/licitaciones/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Nueva licitación
        </Link>
      </div>

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {licitaciones.map((l) => {
          const cliente = Array.isArray(l.clientes) ? l.clientes[0] : l.clientes;
          return (
            <li key={l.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <Link
                  href={`/licitaciones/${l.id}`}
                  className="font-medium text-gray-900 hover:underline"
                >
                  {l.titulo}
                </Link>
                <p className="text-sm text-gray-500">{cliente?.nombre}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-medium text-gray-900">
                  {ESTADO_LABELS[l.estado] ?? l.estado}
                </p>
                <p className="text-gray-500">
                  Vence: {new Date(l.fecha_limite).toLocaleDateString("es")}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
