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
7. `docs/marca/absolute-texto.md`: texto base da Absolute ZRO (tom técnico para produtoras, colorista, bio e legendas)

## Quem é a ZRO

- **ZRO Produção Audiovisual LTDA**, nome de marca **ZRO Filmes**, em Natal/RN. Instagram: **@zrofilmes**
- Produtora audiovisual e criativa, **autoral e cinematográfica**: filmes de marca, campanhas, conteúdo, documental e direção criativa
- "ZRO" é o **zero**: origem, o ponto antes da forma
- **Assinatura oficial:** "Onde tudo começa e o comum termina."
- **Absolute ZRO:** o braço de finalização e color grading, com o azul como cor conceitual

## Sócios

- **Victor Barroso:** criativo. Está nas produções e cuida do nível de qualidade da entrega. Faz a cor da Absolute ZRO, mas **os textos públicos não levam o nome dele**: a Absolute assina como empresa (casa de color grading high-end, pensando em equipe). É quem conversa com o Claude aqui.
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
- [x] Stack: Next.js 16 + Tailwind 4 + Drizzle/Postgres (PGlite local, Neon em São Paulo na produção), login próprio com sessão assinada
- [x] Site público (início, filmes, sobre, Absolute ZRO, privacidade) e funil de orçamento até o WhatsApp
- [x] Área interna: painel, freelas; CRM, projetos, agenda e documentos, orçamentos com PDF, financeiro, processos, site e ajustes
- [x] Pronto pra Vercel: `vercel.json`, banco preparado no build, sitemap, robots e imagem de compartilhamento (passo a passo no `DEPLOY.md`)
- [x] Publicado em https://zrofilmes.vercel.app, com WhatsApp, e-mail e filmes do YouTube configurados
- [x] Integração: diária na agenda → equipe do projeto (valor por diária) → pagamento no financeiro → histórico do cliente no CRM; dashboard com abas (Resumo, Projetos, Freelas a pagar, Fluxo)
- [x] Orçamento com item avulso e pacote personalizado (opção de salvar no catálogo); freelas com foto, funções personalizadas e banco de equipamentos (busca, categorias, quem tem o quê); clientes do CRM com logo (imagens no banco, entram no backup)
- [x] App no iPhone (Adicionar à Tela de Início) e imagem de compartilhamento para WhatsApp; links para mandar: `/instalar` (site) e `/instalar/interno` (painel), com o passo a passo no iPhone e no Android e "Abrir no Safari"
- [x] Pauta (`/painel/pauta`, código em `painel/quadro/`): o Quadro (kanban) da Maestro com a cara da ZRO; o Victor pediu o nome "Pauta" para a tela. Método igual (8 colunas, próximo passo, filtros, Por prazo, ficha), especificação em `docs/quadro/`. Banco próprio (`quadro_cards` por campo, lápide, histórico em `quadro_historico`), endereço fixo `/painel/quadro/banco` e atualização a cada 4 s. Provas: lista do `docs/quadro/PROMPT.md`, no computador e em 390 px
- [x] Processos: pós-produção completa nos modelos (backup, decupagem, montagem, corte travado, conform, color, som, versões, render, QC, entrega e arquivamento) e modelo "Pós-produção (Absolute ZRO)"; modelos de fábrica já salvos são atualizados uma vez no deploy (marcador `processos-pos:v1`), os editados à mão ficam como estão
- [x] Cliente recorrente (CRM → cliente → "Projeto recorrente"): diárias de captação por mês, valor fixo, dia do pagamento, início e entregas de todo mês (`clients.recurring`); o perfil mostra o mês corrente (diárias feitas/agendadas e recebido do valor fixo) e a lista ganha o selo "Recorrente"
- [x] Recorrente automático (`src/lib/services/recurring.ts`): todo mês, ao abrir o painel (ou ao salvar o cliente), gera a cobrança do valor fixo no Financeiro (vence no dia do pagamento) e um card por entrega na coluna Pauta (prazo: fim do mês; id fixo `rec_<cliente>_<AAAAMM>_<n>`). Duas caixas no cadastro ligam/desligam cada parte. A trava é `recurring_runs` (cliente + mês): não duplica; se já existe entrada do cliente no mês com o mesmo valor, não cria outra. Visão geral → Resumo mostra "Contratos recorrentes" (total por mês, diárias, entregas prontas e situação da cobrança)
- [x] Perfil do usuário com foto (Ajustes → Minha conta; abre pelo nome no rodapé do menu)
- [x] Absolute ZRO: identidade e página iguais ao board do Victor (`brand/absolute-zro/referencia-board.png`): A B S O L U T E + ZR próprio com o anel azul, paleta #000/#0B1F2D/#2D7BFF/#F5F7FA, Montserrat, arte do board (eclipse e paisagem) em `public/media/absolute/`, sem mockups

## Escolhas provisórias (a confirmar com o Victor)

- **Categorias do portfólio:** Filmes de marca, Campanhas, Conteúdo, Documental, Experiências (eventos) e Direção criativa
- **Preço no site:** não aparece por enquanto; o valor fica para o funil e para o orçamento
- **Casamentos:** fora das categorias da ZRO até o Victor dizer o contrário
- **Dados de exemplo:** ids começando com `demo-`, apagáveis em Ajustes

## Já confirmado pelo Victor

- **WhatsApp comercial:** (84) 98748-0000 · **e-mail de contato:** zro.contato@gmail.com
- **YouTube:** https://www.youtube.com/@ZROFilmes (os filmes do portfólio vêm de lá, em `scripts/lib/base-data.ts`)
- **Clientes no site:** todos podem aparecer
- **Absolute ZRO:** frase de abertura "Cada frame tem uma temperatura."; assina como empresa (sem nome de pessoa); tom de casa de cor high-end (texto base em `docs/marca/absolute-texto.md`)
- **Nada de mostrar o que não é real:** sem mockups de estúdio, porta, roupa, perfil ou números inventados no site. Só arte da marca e trabalho de verdade.
- **Etapas do projeto sem trava:** dá para ir a qualquer etapa; a regra criativa é lembrete, não impede (nem todo projeto passa por todas)
- **Revisores da Pauta:** Victor e Edu
- **Dados nunca podem sumir:** a área interna só roda no endereço oficial (prévias redirecionam), o deploy para se houver dois bancos, e Ajustes → Dados e backup mostra o banco em uso e baixa backup. Não mexer nisso sem falar com o Victor.

## Estrutura

```
DEPLOY.md              como publicar na Vercel (Neon, variáveis, primeiro acesso, custos)
brand/                 logo oficial e referências (filme manifesto, story, quadros)
docs/
  briefing.md          escopo do site e da área interna
  dev/area-interna.md  padrões de código da área interna
  marca/               documento-mestre, identidade visual, mood, voz e tokens
  quadro/              esqueleto, SQL e regras do Quadro (kanban da Maestro)
  referencias-ui/      prints de referência + notas
drizzle/               migrações do banco
scripts/               banco (migrate, seed, setup) e screenshots (Playwright)
src/
  app/(site)/          site público
  app/orcamento/       funil até o WhatsApp
  app/entrar/          login
  app/(painel)/painel/ área interna (um diretório por módulo; quadro/ é o kanban da tela Pauta)
  components/          brand, site, painel, ui
  lib/                 db (schema), domain, format, queries, services, settings
```

## Comandos

- `npm run dev` · `npm run lint` · `npm run typecheck`
- `npm run db:reset` recria o banco local com dados de exemplo (credenciais em `data/credenciais-dev.txt`)
- Screenshots: `node scripts/shot.mjs <url> <saida.png> [largura] [altura] --full` e `node scripts/shot-auth.mjs /painel/... <saida.png>`
