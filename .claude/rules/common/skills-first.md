# Skills primero (find-skills en cada tarea)

## Regla (no negociable)

**Al inicio de CUALQUIER tarea de este repo — antes de planear o escribir código — invoca `/find-skills`**
(o el skill `find-skills`) para descubrir skills, comandos y patrones ya existentes que apliquen.

El objetivo es **reutilizar antes que reinventar**: mejor planning y extrapolación de código a partir de lo
que ya está disponible (skills del proyecto, comandos, utilidades), en línea con el paso 0 "Research & Reuse"
de [development-workflow.md](development-workflow.md).

## Cuándo

- SIEMPRE al recibir un nuevo prompt/tarea (feature, fix, refactor, investigación).
- Antes de proponer un plan o tocar archivos.
- Si `find-skills` no arroja nada aplicable, continúa con el flujo normal — pero la consulta se hace igual.

## Notas

- `find-skills` puede vivir como skill global/plugin del entorno (no necesariamente dentro de `.claude/` de
  este repo). Si no está disponible en la sesión, deja constancia y sigue con el research manual
  (GitHub search / docs / registries) del paso 0 de [development-workflow.md](development-workflow.md).
- No sustituye al resto del research; lo antecede.
