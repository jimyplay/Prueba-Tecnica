# Sistema de Gestión de Licitaciones

Prueba técnica: sistema para redactar licitaciones, adjuntarles una propuesta,
enviarlas formalmente a un cliente (con email real y adjunto), darles
seguimiento hasta su fecha límite (con recordatorio automático), resolverlas
(ganada/perdida) y, si se ganaron, facturarlas y cobrarlas hasta saldar —
todo auditado paso a paso.

**Despliegue:** https://prueba-tecnica-dbw6tjwy8-jimyplay1.vercel.app

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
(`errcode 22023`) se traduce igual a un 409 en `lib/api/errors.ts`. Ese mismo
archivo también traduce errores de Supabase Storage (forma distinta a los de
Postgrest — `status`/`statusCode` en vez de `code`) para que una subida
fallida muestre el motivo real en vez de un 500 genérico.

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
- El documento de propuesta solo puede subirse o quitarse (para reemplazarlo) mientras está en `borrador`.
- Al enviar, se dispara un email real al cliente con el resumen y el documento adjunto.
- Productos bloqueados (no se pueden agregar/quitar) en `finalizada`, `por_cobrar`, `cobrada`, `perdida`.
- Pagos solo en `por_cobrar`; un pago no puede superar el saldo pendiente.
- Al llegar el saldo a $0, la licitación pasa automáticamente a `cobrada` — ya
  sea porque los pagos lo saldaron, o porque se facturó directamente por $0
  (ej. sin productos cargados): en ese caso no hay pago que registrar, así
  que el propio paso a `por_cobrar` dispara el auto-cobro inmediato.
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

`get_advisors` (Supabase) señala además, y se acepta por la misma razón:
- El bucket `propuestas` permite listar sus objetos a cualquier `authenticated`
  (necesario para que `enviar` pueda descargar el documento por su path).
  No expone nada que esas mismas políticas de tablas no expongan ya.
- `pg_net` queda instalado en el schema `public` — Postgres no permite
  reasignarle schema a esa extensión (`ALTER EXTENSION ... SET SCHEMA`
  falla explícitamente para `pg_net`), así que es un warning inevitable
  con este mecanismo de cron.

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

## Nota sobre el remitente de Resend (plan gratuito)

Con el sender por defecto `onboarding@resend.dev` (sin dominio propio
verificado), Resend **solo entrega a la dirección con la que se creó la
cuenta**. Para que el "cliente" de una licitación de prueba reciba el email,
su campo `email` debe ser esa misma dirección. Si se quiere enviar a
cualquier destinatario, hay que verificar un dominio en
resend.com/domains y usar un `from` de ese dominio.

## Evidencia de las integraciones reales

Verificado directamente contra las APIs reales (Resend + Storage) durante el
desarrollo, antes de tener la UI probada en navegador:

- **Email con adjunto**: enviado y confirmado por Resend (`id` de mensaje
  devuelto por `POST https://api.resend.com/emails`, mismo request que arma
  `lib/email/resend.ts` + `app/api/licitaciones/[id]/enviar/route.ts`).
- **Recordatorio automático desde el cron**: se ejecutó manualmente
  `select public.enviar_recordatorios_vencimiento();` sobre una licitación
  real con `fecha_limite` <48h, y se confirmó en `net._http_response` que
  Resend respondió `status_code: 200` con un `id` de mensaje — prueba que el
  camino `pg_cron → pg_net → Resend` funciona end-to-end dentro de Postgres,
  no solo en teoría.
- **Storage**: se subió un archivo real al bucket `propuestas` vía la API
  REST y se confirmó que su URL pública (`/storage/v1/object/public/...`)
  devuelve el contenido correcto con `200 OK`.
- **Datos de prueba usados en estas verificaciones ya fueron eliminados** —
  la base quedó limpia. Falta capturar evidencia "de producto real": crear
  una licitación real desde la UI, enviarla, y guardar captura del email
  recibido + captura del `cron.job_run_details` en el proyecto desplegado.
- **Deploy en Vercel**: verificado público y funcional — `/` redirige a
  `/login` (307), `/login` responde 200, y la API rechaza requests sin
  sesión con 401. El cron corre solo dentro de Supabase independientemente
  del deploy: `cron.job_run_details` muestra ambos jobs en `succeeded` cada
  15 min de forma continua desde que se crearon.

## Pendientes

- [x] Admin bootstrap real en el proyecto desplegado.
- [ ] Probar el flujo completo desde el navegador (creado y verificado por API/SQL hasta ahora; en curso).
- [ ] Evidencia final "de producto real" para la entrega (capturas de email recibido, URL del documento, log de `cron.job_run_details` en producción).
