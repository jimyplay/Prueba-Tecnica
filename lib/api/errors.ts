import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/session";

export class ValidationError extends Error {}
export class NotFoundError extends Error {}
/** Violacion de regla de negocio (transicion invalida, presupuesto, saldo, etc). */
export class ConflictError extends Error {}

function isPostgrestError(
  error: unknown
): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}

/**
 * Traduce errores de dominio y errores de Postgres (triggers) a una
 * respuesta HTTP consistente. Las reglas de negocio viven en triggers de la
 * base de datos (fuente de verdad); sus `RAISE EXCEPTION ... errcode 22023`
 * llegan aca como PostgrestError y se mapean a 409.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Datos invalidos", details: error.flatten() },
      { status: 400 }
    );
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (isPostgrestError(error)) {
    if (error.code === "22023") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error.code === "23505") {
      return NextResponse.json({ error: "Registro duplicado" }, { status: 409 });
    }
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
  }

  console.error(error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
