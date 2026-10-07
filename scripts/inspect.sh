#!/usr/bin/env sh
# Opens MCP Inspector against the built server. Same as `npm run inspect`.
set -e
cd "$(dirname "$0")/.."
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
