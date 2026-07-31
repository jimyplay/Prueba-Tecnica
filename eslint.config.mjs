import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Estas reglas (nuevas en eslint-plugin-react-hooks, pensadas para
      // React Compiler) desaprueban el patron clasico "fetch en useEffect +
      // setState" que usan las paginas cliente de este proyecto. Migrar todo
      // a Suspense/RSC esta fuera del alcance de 3 dias; se degradan a warn
      // en vez de silenciarlas.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scaffolding ajeno al codigo de la app (agentes/skills de Claude Code).
    ".claude/**",
    ".agents/**",
  ]),
]);

export default eslintConfig;
