# Plan: Store MCP Server — herramientas de negocio para Claude

## Contexto

Segundo proyecto de IA del portafolio. Un servidor **Model Context Protocol** en TypeScript que expone, como herramientas, la base de datos ficticia "Colmado Digital" (la misma que crea Ask Your DB en Neon). Conectado a Claude Desktop, Claude responde preguntas de negocio llamando a esas herramientas. Muestra que entiendes MCP desde dentro: definición de tools con schemas, validación de entradas, respuestas estructuradas y pruebas.

Decisiones tomadas:

- Carpeta: `D:\store-mcp` (repo `wildensnz/mcp-server`; si prefieres otro nombre, cambiar aquí y en el README de perfil, que hoy apunta a `mcp-server`).
- Datos: **reutiliza la DB de Ask Your DB** en Neon, con el mismo rol de solo lectura `askdb_reader`. Requisito: Ask Your DB Fase 2 terminada.
- **Solo lectura.** Ninguna herramienta escribe.
- Conexión **local por stdio** con Claude Desktop y MCP Inspector. Sin despliegue remoto.
- Stack: Node 22, TypeScript strict, `@modelcontextprotocol/server` (`McpServer`, `registerTool`, `StdioServerTransport`), `zod`, `pg`, Vitest, tsup o `tsc` para compilar. Mismas convenciones de Prettier/ESLint que MapGEO y Ask Your DB.

## Qué hace el demo

El usuario abre Claude Desktop y pregunta "¿quiénes son mis 5 mejores clientes este año?" o "¿qué productos están por agotarse?". Claude llama a una herramienta del servidor, que ejecuta una consulta SQL fija y parametrizada (aquí el modelo no escribe SQL; eso es Ask Your DB) y devuelve datos limpios. Capturas para el README: el chat de Claude Desktop mostrando la llamada y la respuesta, y el MCP Inspector listando las herramientas.

## Herramientas (6, todas de lectura)

| Tool                   | Entrada (zod)                                                                | Devuelve                                                             |
| ---------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `search_customers`     | `query: string`, `limit?: 1–20`                                              | id, nombre, provincia, vendedor                                      |
| `get_customer_summary` | `customerId: number`                                                         | datos del cliente, total comprado, último pedido, pedidos pendientes |
| `list_orders`          | `customerId?`, `status?: paid\|pending\|cancelled`, `from?`, `to?`, `limit?` | lista de pedidos con total                                           |
| `get_order`            | `orderId: number`                                                            | cabecera + líneas                                                    |
| `low_stock_products`   | `threshold?: number` (default 10), `limit?`                                  | productos bajo el umbral                                             |
| `sales_report`         | `groupBy: month\|category\|sales_rep\|province`, `from?`, `to?`              | filas agregadas en RD$                                               |

Cada tool devuelve `content` de texto (markdown compacto, legible por el modelo) y `structuredContent` (JSON tipado) para clientes que lo soporten. Errores de validación o "no encontrado" se devuelven con `isError: true` y mensaje claro, nunca como excepción.

Además, 1 **resource** de solo lectura: `store://schema`, con la descripción de las tablas, para que Claude entienda el dominio sin llamar herramientas.

## Estructura del proyecto

```
store-mcp/
├── src/
│   ├── index.ts              # crea McpServer, registra tools y resource, stdio
│   ├── db.ts                 # pool pg con DATABASE_URL (rol lector), timeout 5 s
│   ├── format.ts             # money RD$, fechas, tabla markdown compacta
│   ├── tools/
│   │   ├── search-customers.ts
│   │   ├── get-customer-summary.ts
│   │   ├── list-orders.ts
│   │   ├── get-order.ts
│   │   ├── low-stock-products.ts
│   │   └── sales-report.ts   # cada archivo: schema zod + handler + SQL parametrizado
│   └── resources/schema.ts
├── tests/
│   ├── tools.test.ts         # handlers con db mockeada: validación, formato, errores
│   └── format.test.ts
├── scripts/inspect.sh        # npx @modelcontextprotocol/inspector node dist/index.js
├── .github/workflows/ci.yml
├── .env.example, README.md, docs/screenshots/
```

Env: `DATABASE_URL` (rol `askdb_reader`, la misma de Ask Your DB).

## Fases

### Fase 0 — Preparación (tú)

- Ask Your DB con la Fase 2 hecha (DB sembrada y `DATABASE_URL` del rol lector a mano).
- Crear `D:\store-mcp` con `CLAUDE.md` y `PLAN.md`; repo público vacío en GitHub.
- Claude Desktop instalado en tu PC.

### Fase 1 — Scaffold

- `npm init`, TypeScript strict (`module: NodeNext`), `@modelcontextprotocol/server`, `zod`, `pg`; dev: `vitest`, `tsx`, `@types/pg`, `@types/node`, prettier, eslint.
- Scripts: `build` (tsc → `dist/`), `dev` (`tsx src/index.ts`), `inspect`, `check`.
- `src/index.ts` con un tool `ping` para probar la tubería con MCP Inspector. Commit.

### Fase 2 — Base y formato

- `src/db.ts`: pool, `statement_timeout`, helper `query<T>(sql, params)`.
- `src/format.ts`: `money()`, `date()`, `table(rows)`; tests.

### Fase 3 — Herramientas

- Implementar las 6 tools, una por archivo, con `registerTool(name, { title, description, inputSchema }, handler)`. Descripciones escritas pensando en el modelo: cuándo usarla y qué devuelve.
- `structuredContent` + `outputSchema` zod en cada una.
- Tests por tool con `db.query` mockeado: entradas inválidas, sin resultados, caso feliz.
- Resource `store://schema`.

### Fase 4 — Conexión con Claude Desktop

- Añadir al `claude_desktop_config.json` la entrada `store` con `command: node`, `args: [D:\\store-mcp\\dist\\index.js]`, `env: { DATABASE_URL }`. Documentar en README.
- Probar 6 preguntas en Claude Desktop (una por tool). Tomar capturas.

### Fase 5 — Pulido y publicación

- CI (typecheck, lint, test). README en inglés: qué es, capturas, tabla de tools, "How MCP works" en 5 líneas, instalación en Claude Desktop, seguridad (rol lector, consultas parametrizadas, timeouts, límites).
- Push a `main`, descripción y topics en GitHub (`mcp`, `model-context-protocol`, `typescript`, `claude`, `postgresql`).

## Verificación

- `npm run check` verde.
- `npm run inspect` abre MCP Inspector: aparecen las 6 tools y el resource; `search_customers` con `query: "ferre"` devuelve filas.
- En Claude Desktop: "¿Qué productos están por agotarse?" → llama `low_stock_products` y responde con la lista; "Ventas por mes de este año" → `sales_report` con `groupBy: month`.
- `get_order` con id inexistente → respuesta `isError` clara, el servidor no se cae.
- Entrada inválida (`limit: 500`) → rechazada por zod con mensaje.
- CI verde en el primer push.
