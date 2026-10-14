#!/bin/bash
# Prepara a sessão do Claude Code na web: dependências e banco local.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# O navegador do Playwright já vem instalado no ambiente.
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

npm install --no-audit --no-fund

# Banco local (Postgres via PGlite em data/pglite): migra sempre; dados de exemplo só na primeira vez.
if [ -d data/pglite ]; then
  npm run db:migrate
else
  npm run db:migrate
  npm run db:seed
fi
