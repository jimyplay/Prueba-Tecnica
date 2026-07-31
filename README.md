# Sistema de Gestión de Licitaciones

Prueba técnica: sistema para redactar licitaciones, adjuntarles una propuesta,
enviarlas formalmente a un cliente (con email real y adjunto), darles
seguimiento hasta su fecha límite (con recordatorio automático), resolverlas
(ganada/perdida) y, si se ganaron, facturarlas y cobrarlas hasta saldar —
todo auditado paso a paso.

## Stack

- **Next.js 16** (App Router, TypeScript) — full-stack, un solo repo/deploy.
- **Supabase**: Postgres + Auth (email/password) + Storage (documentos de propuesta).
- **Resend**: email transaccional con adjuntos.
- **`pg_cron` + `pg_net`**: job programado para vencimiento automático y
  recordatorio, corriendo dentro de Postgres (no depende de que la app esté
  desplegada ni de límites de cron de la plataforma de hosting).
- **Vercel**: deploy del frontend/API.

## Arquitectura

La máquina de estados y las reglas de negocio están implementadas como
**triggers de Postgres** (`supabase/migrations/0001_init.sql`) — son la
fuente de verdad real, porque también deben cubrir las transiciones
automáticas que dispara el cron (vencimiento, auto-cobro), no solo las que
pasan por la API. La capa de dominio en `lib/domain/licitaciones/` (
`state-machine.ts`, `validators.ts`, `service.ts`) espeja esas mismas reglas
únicamente para devolver errores legibles antes de golpear la base de datos;
si un trigger rechaza algo que la app no anticipó, el error de Postgres
(`errcode 22023`) se traduce igual a un 409 en `lib/api/errors.ts`.

```
supabase/migrations/     Esquema, triggers, RLS, cron (fuente de verdad)
lib/domain/licitaciones/ Máquina de estados + reglas de negocio (espejo, UX)
lib/supabase/            Clientes Supabase (sesión, browser, service-role)
lib/auth/session.ts      getSessionUser() / requireAdmin()
lib/api/errors.ts        Mapeo de errores de dominio y de Postgres a HTTP
lib/email/               Cliente Resend + template del correo de envío
app/api/                 Endpoints REST
app/(dashboard)/         UI (requiere sesión, la guarda proxy.ts)
app/(auth)/login/        Login
proxy.ts                 Middleware (Next.js 16 renombró middleware.ts a proxy.ts)
```

### Máquina de estados

`borrador → activa → finalizada → por_cobrar → cobrada`, más `activa → perdida`
(manual o automática). Solo esas 5 transiciones son válidas; cualquier otra
combinación se rechaza. Cada cambio de estado — incluidos los automáticos del
cron — queda registrado en `historial_transiciones` (usuario `null` = sistema).

### Reglas de negocio (todas aplicadas en triggers)

- El total de productos de una licitación no puede superar su presupuesto máximo.
- Solo se puede enviar (`borrador → activa`) con documento de propuesta adjunto.
- Al enviar, se dispara un email real al cliente con el resumen y el documento adjunto.
- Productos bloqueados (no se pueden agregar/quitar) en `finalizada`, `por_cobrar`, `cobrada`, `perdida`.
- Pagos solo en `por_cobrar`; un pago no puede superar el saldo pendiente.
- Al llegar el saldo a $0, la licitación pasa automáticamente a `cobrada`.
- Job programado (`pg_cron`, cada 15 min): `activa` con `fecha_limite` vencida → `perdida`;
  `activa` con menos de 48h para vencer → recordatorio por email (una sola vez, vía `reminder_sent_at`).

### Autenticación y roles

Supabase Auth (email/password). `public.usuarios` espeja `auth.users` vía
trigger, con `role` (`admin`/`user`). "Solo admins crean usuarios" está
garantizado en dos capas: el endpoint `POST /api/usuarios` verifica el rol
del que llama, **y** la tabla `usuarios` no tiene política RLS de `INSERT`
para `authenticated` — solo es escribible con el cliente service-role, así
que ni un bypass del chequeo de la app permitiría crear usuarios sin pasar
por ese endpoint.

### Simplificación deliberada de RLS

Es una herramienta interna de un solo tenant; el enunciado no pide reglas de
ownership por fila. Las políticas RLS de `clientes`/`productos`/`licitaciones`/etc.
son `to authenticated using (true)` — cualquier usuario autenticado puede
leer/escribir. La seguridad real de las reglas de negocio vive en los
triggers (ver arriba), no en RLS. Esto se documenta acá explícitamente como
decisión de alcance, no como descuido.

## Setup local

1. `npm install`
2. Copiar `.env.local.example` a `.env.local` y completar:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: del proyecto Supabase (Project Settings → API).
   - `SUPABASE_SERVICE_ROLE_KEY`: idem, **secreta**, no exponer en el cliente.
   - `RESEND_API_KEY`: de [resend.com](https://resend.com) (plan gratuito). Solo la usa el envío inicial (con adjunto); el recordatorio del cron usa su propia copia guardada en Supabase Vault (ver abajo).
3. Aplicar las migraciones de `supabase/migrations/` al proyecto Supabase (en orden — ya aplicadas al proyecto de desarrollo de esta prueba; si se parte de un proyecto Supabase nuevo, aplicarlas con la CLI de Supabase o pegándolas en el SQL Editor del dashboard, en orden numérico).
4. Guardar la API key de Resend en Vault para que el cron pueda enviar recordatorios:
   ```sql
   select vault.create_secret('re_xxxxxxxx', 'resend_api_key');
   ```
5. En el dashboard de Supabase → Authentication → Providers → Email: desactivar **"Allow new users to sign up"** (el único alta de usuarios debe ser vía `POST /api/usuarios`, admin-gated).
6. Crear el primer admin (bootstrap manual, ya que nadie más puede crear el primero):
   - Dashboard → Authentication → Users → Add user (email/password).
   - `update public.usuarios set role = 'admin' where email = 'tu-email@ejemplo.com';`
7. `npm run dev` y entrar con ese usuario en `http://localhost:3000`.

## Evidencia de las integraciones reales

_(pendiente de completar una vez cargada una cuenta real de Resend — ver "Pendientes")._

- Email real recibido con documento adjunto: _(captura/log de Resend)_
- URL real y accesible del documento subido a Storage: _(bucket `propuestas`, público)_
- Corrida del cron en producción: `select * from cron.job_run_details order by start_time desc;` en el proyecto Supabase.

## Pendientes (requieren credenciales del usuario, no bloquean el resto del código)

- [ ] Cuenta de Resend + API key (`RESEND_API_KEY` local + secreto `resend_api_key` en Vault).
- [ ] Deploy en Vercel (env vars: URL/anon key públicas, service-role key server-only).
- [ ] Admin bootstrap real (pasos 5–6 de arriba).
- [ ] Evidencia final (capturas de email recibido, URL del documento, log de `cron.job_run_details`).
