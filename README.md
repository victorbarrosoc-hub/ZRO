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

## Publicar (Vercel + Turso)

Endereço: **https://zrofilmes.vercel.app**. Passo a passo completo no [`DEPLOY.md`](DEPLOY.md).

Resumo: projeto `zrofilmes` na Vercel → variáveis (`SESSION_SECRET`, `ZRO_*`, `NEXT_PUBLIC_SITE_URL`) → banco Turso conectado pela aba Storage → Redeploy. O build (`npm run vercel-build`) aplica as migrações e cria as contas dos sócios sozinho.

## Documentação

- `docs/briefing.md`: o que o site e a plataforma precisam ter
- `docs/marca/`: documento-mestre, identidade visual, mood, voz e tokens
- `docs/referencias-ui/`: referências visuais e o que foi aproveitado de cada uma
- `docs/dev/area-interna.md`: padrões de código da área interna
