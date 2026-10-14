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
# Com o `npm run dev` no ar, o arquivo já está aberto pelo servidor local: migra por ele.
# Abrir o mesmo arquivo duas vezes estraga o banco local.
if (exec 3<>/dev/tcp/127.0.0.1/"${ZRO_LOCAL_DB_PORT:-54329}") 2>/dev/null; then
  ZRO_LOCAL_DB_URL="postgres://postgres:postgres@127.0.0.1:${ZRO_LOCAL_DB_PORT:-54329}/postgres" npm run db:migrate
elif [ -d data/pglite ]; then
  npm run db:migrate
else
  npm run db:migrate
  npm run db:seed
fi
