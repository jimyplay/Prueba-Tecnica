import { Resend } from "resend";

let client: Resend | null = null;

export function getResendClient(): Resend {
  if (!client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY no configurada");
    }
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}
