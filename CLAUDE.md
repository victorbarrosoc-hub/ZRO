@AGENTS.md

# ZRO: contexto do projeto

Este repositório é **o site da ZRO e a plataforma interna da produtora** (Next.js 16).

Antes de propor ou construir qualquer coisa, leia:

1. `docs/marca/documento-mestre.md`: a fonte de verdade da marca (conceito, manifesto, tom de voz, regras)
2. `docs/briefing.md`: o que o site e a área interna precisam ter, dados que já existem e pendências
3. `docs/marca/identidade-visual.md`: leitura técnica do logo, das cores, da tipografia e do filme manifesto
4. `docs/referencias-ui/README.md`: as referências de UI/UX e o que levar de cada uma
5. `docs/dev/area-interna.md`: padrões de código da área interna (obrigatório antes de mexer em `/painel`)
6. `docs/marca/mood.md`, `voice.md` e `tokens.md`: usados pelas skills de crítica de marca

## Quem é a ZRO

- **ZRO Produção Audiovisual LTDA**, nome de marca **ZRO Filmes**, em Natal/RN. Instagram: **@zrofilmes**
- Produtora audiovisual e criativa, **autoral e cinematográfica**: filmes de marca, campanhas, conteúdo, documental e direção criativa
- "ZRO" é o **zero**: origem, o ponto antes da forma
- **Assinatura oficial:** "Onde tudo começa e o comum termina."
- **Absolute ZRO:** o braço de finalização e color grading, com o azul como cor conceitual

## Sócios

- **Victor Barroso:** criativo. Está nas produções e cuida do nível de qualidade da entrega. É quem conversa com o Claude aqui.
- **Edu Cardoso** (Eduardo Rocha Cardoso): administrativo e financeiro. Cuida da parte burocrática: propostas, notas, certidões e contratos.
- A área interna da plataforma é **só para os dois**.

## Regras de marca que valem pra qualquer texto ou tela

- **Base preto e branco**, alto contraste, grandes áreas negativas, grão sutil, círculo e ponto de luz. Cor só com intenção narrativa.
- **Tom:** conceitual mas compreensível, sofisticado mas humano, poético sem ser abstrato demais, seguro sem arrogância. Frases curtas e fortes.
- **Não parecer:** genérico, infantil, corporativo demais, publicitário demais ou "videomaker de evento"
- **Manifesto e frases-chave:** usar exatamente como estão no documento-mestre
- "Histórias que não aceitam ser comuns" é frase **pra usar com moderação**

## Como trabalhar com o Victor

- Responder em **português do Brasil**, direto ao ponto, com tópicos e negrito pra leitura rápida
- Tom natural e humano, sem jargão corporativo
- Evitar clichês de IA ("revolucionário", "mergulhar profundamente", "crucial")
- Ao pedir títulos, textos ou ideias, oferecer **pelo menos 3 variações**
- Ele também criou o **Carro do Freela** (plataforma de freelas do audiovisual de Natal). A área interna da ZRO conversa com o que o Carro do Freela já tem desenhado.

## Clientes que já aparecem nos arquivos

- **SERHS** (Grand Hotel, Beach e Pipa): conteúdo para hotelaria, com negociação de contrato recorrente em 2027
- **SESI/FIEPB:** projeto Nordeste Criativo
- **SUDECO:** vídeo institucional e "Caravana"
- **Quartzo Soluções em Audiovisual**
- A ZRO fez **adequação à LGPD** (Sebrae/FUNCERN). Dados de clientes e freelas precisam respeitar isso.

## Status

- [x] Contexto, documento-mestre, identidade visual, briefing e referências de UI registrados
- [x] Stack: Next.js 16 + Tailwind 4 + Drizzle/libSQL (SQLite local, Turso em produção), login próprio com sessão assinada
- [x] Site público (início, filmes, sobre, Absolute ZRO, privacidade) e funil de orçamento até o WhatsApp
- [x] Área interna: painel, freelas; CRM, projetos, agenda e documentos, orçamentos com PDF, financeiro, processos, site e ajustes
- [x] Pronto pra Vercel: `vercel.json`, banco preparado no build, sitemap, robots e imagem de compartilhamento (passo a passo no `DEPLOY.md`)
- [ ] Publicar em https://zrofilmes.vercel.app e configurar WhatsApp, links dos vídeos e dados reais

## Escolhas provisórias (a confirmar com o Victor)

- **Categorias do portfólio:** Filmes de marca, Campanhas, Conteúdo, Documental, Experiências (eventos) e Direção criativa
- **Preço no site:** não aparece por enquanto; o valor fica para o funil e para o orçamento
- **Casamentos:** fora das categorias da ZRO até o Victor dizer o contrário
- **Dados de exemplo:** ids começando com `demo-`, apagáveis em Ajustes

## Estrutura

```
DEPLOY.md              como publicar na Vercel (Turso, variáveis, primeiro acesso, custos)
brand/                 logo oficial e referências (filme manifesto, story, quadros)
docs/
  briefing.md          escopo do site e da área interna
  dev/area-interna.md  padrões de código da área interna
  marca/               documento-mestre, identidade visual, mood, voz e tokens
  referencias-ui/      prints de referência + notas
drizzle/               migrações do banco
scripts/               banco (migrate, seed, setup) e screenshots (Playwright)
src/
  app/(site)/          site público
  app/orcamento/       funil até o WhatsApp
  app/entrar/          login
  app/(painel)/painel/ área interna (um diretório por módulo)
  components/          brand, site, painel, ui
  lib/                 db (schema), domain, format, queries, services, settings
```

## Comandos

- `npm run dev` · `npm run lint` · `npm run typecheck`
- `npm run db:reset` recria o banco local com dados de exemplo (credenciais em `data/credenciais-dev.txt`)
- Screenshots: `node scripts/shot.mjs <url> <saida.png> [largura] [altura] --full` e `node scripts/shot-auth.mjs /painel/... <saida.png>`
