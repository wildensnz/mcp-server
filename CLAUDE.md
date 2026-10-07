# Store MCP — project context for Claude Code

Portfolio project: a small, well-built **Model Context Protocol server** in
TypeScript that exposes a fictional Dominican distributor's database
("Colmado Digital", shared with my Ask Your DB project) as read-only tools for
Claude Desktop. Priorities: **correct MCP usage → safety → clean, testable code
→ good screenshots.** Do not add features that are not in PLAN.md without asking.

## What it is

Local stdio MCP server. 6 read-only tools + 1 resource over Postgres (Neon),
using the read-only role `askdb_reader` from Ask Your DB. The model never
writes SQL here: every tool runs a fixed, parameterized query.

## Stack

Node 22 · TypeScript strict (`module: NodeNext`) · `@modelcontextprotocol/server`
(`McpServer`, `registerTool`, `StdioServerTransport`) · `zod` · `pg` · Vitest · npm.

## Conventions (same as my other repos)

- Prettier: single quotes, semicolons, trailing commas, 80 cols, 2 spaces.
  ESLint type-checked. `npm run check` (typecheck + lint + format:check + test)
  must pass before every commit.
- One tool per file in `src/tools/`: zod input schema, zod output schema,
  SQL, handler. Pure formatting in `src/format.ts`, tested.
- Tool descriptions are written for the model: when to use it, what it
  returns, units (RD$), limits. Keep them short and concrete.
- Every tool returns `content` (compact markdown) AND `structuredContent`.
  Expected failures ("not found", bad range) return `isError: true` with a
  clear message; never throw out of a handler.
- **stdout is the protocol channel.** Never `console.log`; use
  `console.error` for logs.
- Commit per phase. Never commit `.env`.

## Hard safety rules

- Only `DATABASE_URL` with the reader role. No write statements anywhere.
- All queries parameterized (`$1, $2`), `statement_timeout = 5000`, every
  list capped (`limit` max 50, default 10–20).
- No secrets in tool outputs or logs.

## Done means

`npm run check` green · 6 tools + resource visible in MCP Inspector ·
works in Claude Desktop with screenshots · README with tools table, install
steps and Safety section · CI green.
