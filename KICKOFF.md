# Cómo arrancar Store MCP con Claude Code

## Requisito previo

Ask Your DB debe tener la **Fase 2 terminada** (base de datos sembrada en Neon
y la `DATABASE_URL` del rol lector `askdb_reader`). Este proyecto usa esa misma
base; no crea datos propios.

## Antes de abrir Claude Code (~10 min)

1. Crea la carpeta `D:\store-mcp` y copia dentro `CLAUDE.md` y `PLAN.md`.
2. Crea el repo público y vacío `wildensnz/mcp-server` en GitHub.
3. Crea `D:\store-mcp\.env` con:
   ```
   DATABASE_URL=postgresql://...   # la del rol askdb_reader, de Ask Your DB
   ```
4. Ten Claude Desktop instalado (hace falta en la Fase 4).
5. En el README de tu perfil, cambia el enlace `mcp-server` por `store-mcp`.

## Prompt de arranque (pégalo en Claude Code dentro de D:\store-mcp)

```
Lee CLAUDE.md y PLAN.md. Vamos a construir el proyecto por fases, una a la vez.
Empieza por la Fase 1 (scaffold con un tool `ping`). Al terminar cada fase:
corre `npm run check`, haz commit, y dime en 3 líneas qué hiciste y qué sigue.
No empieces la siguiente fase hasta que yo te diga "siguiente".
```

## Prompts por fase

- Tras la Fase 1, prueba tú mismo: `npm run build` y `npm run inspect`. Debe
  abrirse el MCP Inspector en el navegador con el tool `ping`. Si funciona,
  escribe `siguiente`.
- `siguiente` → Fase 2 (db y formato).
- `siguiente` → Fase 3 (las 6 tools y el resource). Pídele que te muestre la
  descripción de cada tool: son lo que Claude lee para decidir cuándo usarla.
- `siguiente` → Fase 4. Te dará el bloque JSON para `claude_desktop_config.json`
  (en Windows: `%APPDATA%\Claude\claude_desktop_config.json`). Reinicia Claude
  Desktop, haz las 6 preguntas de prueba y toma capturas.
- `siguiente` → Fase 5 (CI, README, push).

## Al terminar

- Descripción y topics en GitHub: `mcp`, `model-context-protocol`,
  `typescript`, `claude`, `postgresql`, `ai-tools`.
- Fíjalo en tu perfil junto a Ask Your DB.
