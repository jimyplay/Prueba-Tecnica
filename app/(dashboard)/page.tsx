import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: proximasAVencer } = await supabase
    .from("licitaciones")
    .select("id, titulo, fecha_limite, reminder_sent_at, clientes(nombre)")
    .eq("estado", "activa")
    .lte("fecha_limite", new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString())
    .order("fecha_limite", { ascending: true });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">
        Licitaciones próximas a vencer (&lt;48h)
      </h1>

      {!proximasAVencer || proximasAVencer.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay licitaciones activas venciendo en las próximas 48 horas.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {proximasAVencer.map((l) => {
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
                <div className="text-right text-sm text-gray-500">
                  <p>Vence: {new Date(l.fecha_limite).toLocaleString("es")}</p>
                  <p>{l.reminder_sent_at ? "Recordatorio enviado" : "Recordatorio pendiente"}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
