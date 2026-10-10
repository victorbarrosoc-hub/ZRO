# Publicar na Vercel

Endereço: **https://zrofilmes.vercel.app**

## O que o código já faz sozinho

- **Build da Vercel** (`vercel.json` → `npm run vercel-build`): prepara o banco (migrações, contas dos sócios, configurações, catálogo, modelos, kits, FAQ, equipe e o filme manifesto) e depois roda o `next build`. Só cria o que falta: nunca apaga nada e nunca coloca dados de exemplo.
- **Banco:** Postgres no **Supabase** (projeto `zro-filmes`, São Paulo), em `DATABASE_URL`. No computador, PGlite (o mesmo Postgres num arquivo) em `data/pglite`.
- **Google:** sitemap, robots (painel e login ficam fora da busca) e imagem de compartilhamento pra link no WhatsApp e no Instagram.
- **Segurança:** cabeçalhos contra site falso em iframe e rastreio, sessão em cookie protegido, limite de tentativas no login.

## Passo a passo (uma vez só)

### 1. Levar o código pra `main`

A Vercel publica em produção o que está na `main`. Fazer o merge da branch `claude/novo-repositorio-vazio-o5r166` na `main` (pull request no GitHub).

### 2. Criar o projeto na Vercel

1. [vercel.com/new](https://vercel.com/new) → importar o repositório `victorbarrosoc-hub/ZRO`.
2. **Project Name:** `zrofilmes` (é o nome que gera `zrofilmes.vercel.app`).
3. **Framework:** Next.js (detecta sozinho). Não mexer em Build Command nem Output.
4. **Environment Variables**, antes de clicar em Deploy:

| Nome | Valor |
|---|---|
| `SESSION_SECRET` | 48 caracteres aleatórios. No Terminal do Mac: `openssl rand -base64 48` |
| `ZRO_VICTOR_EMAIL` | e-mail do Victor pra entrar no painel |
| `ZRO_VICTOR_PASSWORD` | senha com pelo menos 10 caracteres |
| `ZRO_EDU_EMAIL` | e-mail do Edu |
| `ZRO_EDU_PASSWORD` | senha com pelo menos 10 caracteres |
| `NEXT_PUBLIC_SITE_URL` | `https://zrofilmes.vercel.app` |

5. **Deploy.** Esse primeiro deploy para com a mensagem **"Falta o banco de dados"**. É esperado: o passo 3 resolve.

### 3. Conectar o banco (Supabase)

1. No Supabase, projeto `zro-filmes` → botão **Connect** → aba **ORMs**/**Connection string** → **Transaction pooler** (porta **6543**). Copiar a URL e trocar `[YOUR-PASSWORD]` pela senha do banco.
2. Na Vercel → Settings → **Environment Variables** → `DATABASE_URL` = essa URL, marcando **Production** e **Preview**, tipo **Sensitive**.
3. Na primeira publicação num banco novo, criar também `ZRO_ACEITAR_BANCO_NOVO` = `1` (a trava para deploy em banco vazio). Depois que publicar, apagar.
4. **Deployments** → último deploy → `⋯` → **Redeploy**.
5. As funções da Vercel ficam em São Paulo (**gru1**), junto do banco.

> Integração Turso antiga: o código não usa mais as variáveis `TURSO_*`. Dá para desligar em **Storage → zro → Projects → zrofilmes → Disconnect**.

### 4. Primeiro acesso

1. Abrir **https://zrofilmes.vercel.app/entrar** e entrar com o e-mail e a senha do passo 2.
2. **Painel → Ajustes:** conferir WhatsApp (já vem (84) 98748-0000), e-mail, CNPJ, endereço, impostos e condições do orçamento.
3. **Painel → Site:** os 10 filmes do canal do YouTube já entram no primeiro deploy; faltam as fotos da equipe (link do Google Drive serve).
4. Com as contas criadas, dá pra apagar `ZRO_VICTOR_PASSWORD` e `ZRO_EDU_PASSWORD` da Vercel. A senha fica guardada só como hash no banco.

## Depois

- **Cada push na `main` publica sozinho.** Os branches de desenvolvimento do Claude (`claude/…`) não geram prévia (`vercel.json`).
- **Um endereço, um banco:** a área interna só abre em `zrofilmes.vercel.app`. Qualquer prévia da Vercel manda pra lá, pra ninguém trabalhar num banco de teste sem perceber.
- **Dois bancos ligados = deploy parado.** Se `DATABASE_URL` e `POSTGRES_URL` apontarem para bancos diferentes, o build para e lista quais são. Deixe só o certo. O site no ar continua como estava.
- **Banco trocado = deploy parado.** Em produção, cada deploy confere se o banco é o mesmo do deploy anterior, mesmo num redeploy. Se vier um banco vazio, sem o histórico de publicações, ou uma cópia (em out/2026 a integração do Turso criava um banco novo a cada deploy), o build para com `Deploy parado para proteger os dados` e o site continua no ar com os dados de antes. Trocou o banco de propósito? Crie `ZRO_ACEITAR_BANCO_NOVO=1`, publique e apague a variável depois.
- **Conferir o banco:** Painel → Ajustes → **Dados e backup** mostra o nome e a identidade do banco e quantos leads, orçamentos e projetos ele tem. O log de cada deploy mostra a mesma linha (`Banco pronto: …`).
- **Backup:** no mesmo lugar, **Baixar backup (.json)** com tudo, menos senhas. Vale guardar um por semana no Google Drive.
- **Domínio próprio:** Vercel → Settings → Domains → adicionar o domínio → apontar o DNS como a Vercel indicar → trocar `NEXT_PUBLIC_SITE_URL` → Redeploy.
- **Conta nova de sócio:** definir o e-mail e a senha nas variáveis e fazer Redeploy. Contas que já existem não são alteradas.
- **Esqueceu a senha:** em Settings → Environment Variables, criar `ZRO_REDEFINIR_SENHA` = `victor` (ou `edu`) e `ZRO_VICTOR_PASSWORD` (ou `ZRO_EDU_PASSWORD`) com a senha nova (10+ caracteres), e fazer Redeploy. Depois de entrar, apagar as duas variáveis. Cada senha nova só é aplicada uma vez, então um deploy depois não desfaz uma troca feita no painel.

## Custos

- **Vercel:** o plano Hobby (grátis) é só pra uso pessoal e não comercial. Site de empresa, pelos termos da Vercel, pede o **Pro: US$ 20 por mês por membro** (um membro basta).
- **Supabase:** plano Free (500 MB, sobra para a ZRO). Ele **pausa depois de 7 dias sem uso**: sem perder dados, mas o site fica sem banco até reativar no painel do Supabase. O Pro (US$ 25/mês) não pausa e tem backup diário.
- **Higgsfield e geração de imagem:** não usados. Luz, grão e partículas do site são feitos em código.

## Rodar no computador

```bash
npm install
npm run db:reset   # banco local com dados de exemplo (senhas em data/credenciais-dev.txt)
npm run dev        # http://localhost:3000 (sobe junto o banco local; pare o dev antes de db:migrate/db:seed)
```

`npm run db:seed` se recusa a rodar em banco remoto, pra dado de exemplo nunca cair na produção.
