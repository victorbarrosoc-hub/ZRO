# ZRO

**Onde tudo começa e o comum termina.**

Site e plataforma interna da ZRO Filmes, produtora audiovisual de Natal/RN.

- **Site público:** portfólio com os filmes, manifesto, conceito, equipe, Absolute ZRO e o funil de orçamento que termina no WhatsApp
- **Área interna (`/painel`):** só para os sócios. CRM, projetos pelo processo criativo da ZRO, agenda de produções, orçamentos com timbrado em PDF, banco de freelas, financeiro, processos e gestão do conteúdo do site

## Rodar no computador

Precisa de Node.js 20.9 ou mais novo.

```bash
npm install
npm run db:reset   # cria o banco local com dados de exemplo
npm run dev        # http://localhost:3000
```

O `db:reset` mostra no terminal (e salva em `data/credenciais-dev.txt`) o e-mail e a senha de teste para entrar em `/entrar`.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `npm start` | versão de produção |
| `npm run lint` / `npm run typecheck` | qualidade do código |
| `npm run db:migrate` | aplica migrações pendentes |
| `npm run db:seed` | dados base + dados de exemplo (ids `demo-…`) |
| `npm run db:setup` | prepara o banco para uso real, sem exemplos (roda sozinho no deploy) |
| `npm run db:reset` | apaga o banco local e recria com exemplos |
| `npm run db:generate` | gera migração depois de mudar o schema |

## Publicar (Vercel + Postgres no Neon)

Endereço: **https://zrofilmes.vercel.app**. Passo a passo completo no [`DEPLOY.md`](DEPLOY.md).

Resumo: projeto `zrofilmes` na Vercel → variáveis (`SESSION_SECRET`, `ZRO_*`, `NEXT_PUBLIC_SITE_URL`) → banco Neon (São Paulo) conectado pela aba Storage → Redeploy. O build (`npm run vercel-build`) aplica as migrações e cria as contas dos sócios sozinho.

## Google Drive

Pastas de cada projeto, envio de material pelo site (painel, freela e cliente) e área do cliente, tudo no Drive da empresa. Os arquivos vão do navegador direto para o Google. Configuração no [`DEPLOY.md`](DEPLOY.md) (seção 5); plano e protocolo em [`docs/dev/drive.md`](docs/dev/drive.md).

No computador: `node scripts/google-mock/servidor.mjs` sobe um Google falso. Testes: `npx tsx --conditions=react-server --test scripts/tests/drive-*.test.mts`.

## Documentação

- `docs/briefing.md`: o que o site e a plataforma precisam ter
- `docs/marca/`: documento-mestre, identidade visual, mood, voz e tokens
- `docs/referencias-ui/`: referências visuais e o que foi aproveitado de cada uma
- `docs/dev/area-interna.md`: padrões de código da área interna
- `docs/dev/drive.md`: Google Drive (pastas, envios, área do cliente)
