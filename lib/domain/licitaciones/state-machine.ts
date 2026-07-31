import { ConflictError } from "@/lib/api/errors";

export type EstadoLicitacion =
  | "borrador"
  | "activa"
  | "finalizada"
  | "por_cobrar"
  | "cobrada"
  | "perdida";

/**
 * Unica fuente de verdad en la app para transiciones validas. Espeja el
 * trigger `validar_transicion_licitacion` de la migracion 0001_init.sql,
 * que es la fuente de verdad real (se aplica tambien a las transiciones
 * automaticas del cron). Este modulo solo existe para devolver errores
 * legibles antes de golpear la base de datos.
 */
const ALLOWED_TRANSITIONS: Record<EstadoLicitacion, EstadoLicitacion[]> = {
  borrador: ["activa"],
  activa: ["finalizada", "perdida"],
  finalizada: ["por_cobrar"],
  por_cobrar: ["cobrada"],
  cobrada: [],
  perdida: [],
};

export const ESTADOS_NO_EDITABLES: EstadoLicitacion[] = [
  "finalizada",
  "por_cobrar",
  "cobrada",
  "perdida",
];

export function isTransicionValida(
  de: EstadoLicitacion,
  a: EstadoLicitacion
): boolean {
  return ALLOWED_TRANSITIONS[de]?.includes(a) ?? false;
}

export function assertTransicionValida(
  de: EstadoLicitacion,
  a: EstadoLicitacion
): void {
  if (!isTransicionValida(de, a)) {
    throw new ConflictError(`Transicion de estado invalida: ${de} -> ${a}`);
  }
}

export function esEditable(estado: EstadoLicitacion): boolean {
  return !ESTADOS_NO_EDITABLES.includes(estado);
}

export function assertEditable(estado: EstadoLicitacion): void {
  if (!esEditable(estado)) {
    throw new ConflictError(
      `No se pueden modificar productos de una licitacion en estado ${estado}`
    );
  }
}
