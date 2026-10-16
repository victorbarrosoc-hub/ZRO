# Publicar na Vercel

Endereço: **https://zrofilmes.vercel.app**

## O que o código já faz sozinho

- **Build da Vercel** (`vercel.json` → `npm run vercel-build`): prepara o banco (migrações, contas dos sócios, configurações, catálogo, modelos, kits, FAQ, equipe e o filme manifesto) e depois roda o `next build`. Só cria o que falta: nunca apaga nada e nunca coloca dados de exemplo.
- **Banco:** Postgres no **Neon** (São Paulo), ligado pela integração Neon da Vercel, em `DATABASE_URL`. No computador, PGlite (o mesmo Postgres num arquivo) em `data/pglite`.
- **Google:** sitemap, robots (painel e login ficam fora da busca) e imagem de compartilhamento pra link no WhatsApp e no Instagram.
- **Segurança:** cabeçalhos contra site falso em iframe e rastreio, sessão em cookie protegido, limite de tentativas no login.
- **Drive:** cria as pastas de cada projeto, recebe material de freelas e clientes direto no Google Drive e mostra as entregas na área do cliente.

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

### 3. Conectar o banco (Neon)

1. Na Vercel, projeto **zrofilmes** → **Storage** → **Create Database** → **Neon**, região **São Paulo (sa-east-1)**, plano **Free** → **Connect** ao projeto. A integração cria `DATABASE_URL` (com pooler) e as variáveis `POSTGRES_*`/`PG*`.
2. Outro Postgres serve (Supabase: **Transaction pooler**, porta 6543): basta pôr a URL em `DATABASE_URL`, tipo **Sensitive**.
3. Na primeira publicação num banco novo, criar também `ZRO_ACEITAR_BANCO_NOVO` = `1` (a trava para deploy em banco vazio). Depois que publicar, apagar.
4. **Deployments** → último deploy → `⋯` → **Redeploy**.
5. As funções da Vercel ficam em São Paulo (**gru1**), junto do banco.

> Integração Turso antiga: o código não usa mais as variáveis `TURSO_*`. Dá para desligar em **Storage → zro → Projects → zrofilmes → Disconnect**.

### 4. Primeiro acesso

1. Abrir **https://zrofilmes.vercel.app/entrar** e entrar com o e-mail e a senha do passo 2.
2. **Painel → Ajustes:** conferir WhatsApp (já vem (84) 98748-0000), e-mail, CNPJ, endereço, impostos e condições do orçamento.
3. **Painel → Site:** os 10 filmes do canal do YouTube já entram no primeiro deploy; faltam as fotos da equipe (link do Google Drive serve).
4. Com as contas criadas, dá pra apagar `ZRO_VICTOR_PASSWORD` e `ZRO_EDU_PASSWORD` da Vercel. A senha fica guardada só como hash no banco.

### 5. Google Drive (pastas, envios e área do cliente)

Uns 20 minutos, uma vez só. Plano completo em `docs/dev/drive.md`.

**5.1 Google Cloud: projeto próprio "ZRO Site"** (separado do SOBEDESCE)
1. Entrar em [console.cloud.google.com](https://console.cloud.google.com) com **contato@dissesim.com.br**.
2. No seletor de projetos, conferir que a **organização dissesim.com.br** está escolhida. **Novo projeto** → nome `ZRO Site` → Criar. Se a organização não aparecer, quem administra o Workspace precisa liberar a criação de projetos para essa conta.
3. **APIs e serviços → Biblioteca → Google Drive API → Ativar.**
4. **Google Auth Platform → Branding:** nome `ZRO Site`, e-mail de suporte `contato@dissesim.com.br`, página inicial `https://zrofilmes.vercel.app`, política `https://zrofilmes.vercel.app/privacidade`.
5. **Público-alvo: Interno.** Sem aviso de "app não verificado" e sem a conexão expirar em 7 dias. Só contas de dissesim.com.br conseguem conectar.
6. **Acesso a dados → Adicionar escopos:** `https://www.googleapis.com/auth/drive`.
7. **Clientes → Criar cliente → Aplicativo da Web**, nome `ZRO Site (web)`.
   - **URIs de redirecionamento autorizados:** `https://zrofilmes.vercel.app/api/google/callback` (e `http://localhost:3000/api/google/callback` para testes no computador).
   - **Criar.** Copiar o ID e o **segredo na hora** (baixar o JSON: o segredo só aparece uma vez).

**5.2 Google Workspace (admin.google.com)**, só se algo for bloqueado
- **Apps → Google Workspace → Drive e Documentos → Compartilhamento:** compartilhamento fora de dissesim.com.br **ativado**, com links "qualquer pessoa com o link". Sem isso, o cliente não baixa pelo link.
- **Segurança → Controles de API → Acesso de apps de terceiros:** se aparecer "acesso bloqueado" ao conectar, marcar o app **ZRO Site** como confiável.
- Os nomes no console do Google mudam com frequência. O caminho acima é o de hoje.

**5.3 Vercel → zrofilmes → Settings → Environment Variables**

| Nome | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | o ID do passo 5.1.7 |
| `GOOGLE_CLIENT_SECRET` | o segredo do cliente (tipo **Sensitive**) |
| `ZRO_DRIVE_KEY` | no Terminal do Mac: `openssl rand -base64 32` (tipo **Sensitive**). Guardar também no gerenciador de senhas. |

Depois: **Deployments → Redeploy**.

**5.4 Conectar, no navegador do computador** (não pelo app do iPhone)
- Painel → Ajustes → **Google Drive** → **Conectar Google** → entrar com **contato@dissesim.com.br** → permitir o acesso ao Drive.

**5.5 Testar o envio direto**
- No mesmo lugar, **Testar neste aparelho**: no Chrome do computador, no Safari do iPhone e no app da tela inicial.
- Tudo "ok": pronto. Algo "falhou": mandar o print. O plano B está em `docs/dev/drive.md` (seção 9).

## Depois

- **Cada push na `main` publica sozinho.** Os branches de desenvolvimento do Claude (`claude/…`) não geram prévia (`vercel.json`).
- **Um endereço, um banco:** a área interna só abre em `zrofilmes.vercel.app`. Qualquer prévia da Vercel manda pra lá, pra ninguém trabalhar num banco de teste sem perceber.
- **Dois bancos ligados = deploy parado.** Se `DATABASE_URL` e `POSTGRES_URL` apontarem para bancos diferentes, o build para e lista quais são. Deixe só o certo. O site no ar continua como estava.
- **Banco trocado = deploy parado.** Em produção, cada deploy confere se o banco é o mesmo do deploy anterior, mesmo num redeploy. Se vier um banco vazio, sem o histórico de publicações, ou uma cópia (em out/2026 a integração do Turso criava um banco novo a cada deploy), o build para com `Deploy parado para proteger os dados` e o site continua no ar com os dados de antes. Trocou o banco de propósito? Crie `ZRO_ACEITAR_BANCO_NOVO=1`, publique e apague a variável depois.
- **Conferir o banco:** Painel → Ajustes → **Dados e backup** mostra o nome e a identidade do banco e quantos leads, orçamentos e projetos ele tem. O log de cada deploy mostra a mesma linha (`Banco pronto: …`).
- **Backup:** no mesmo lugar, **Baixar backup (.json)** com tudo, menos senhas. Vale guardar um por semana no Google Drive.
- **Domínio próprio:** Vercel → Settings → Domains → adicionar o domínio → apontar o DNS como a Vercel indicar → trocar `NEXT_PUBLIC_SITE_URL` → Redeploy. Cadastrar também o novo endereço de retorno no cliente OAuth do Google (`https://<domínio>/api/google/callback`).
- **Trocou `SESSION_SECRET`?** O Drive continua conectado; quem tem área do cliente com senha digita a senha de novo.
- **Perdeu `ZRO_DRIVE_KEY`?** Criar outra (`openssl rand -base64 32`), Redeploy, **Reconectar** em Ajustes → Google Drive e **Trocar link** nas diárias e áreas do cliente ativas. Nada some do Drive nem do banco.
- **Cliente OAuth sem uso por 6 meses é apagado pelo Google:** se o Drive ficar parado tanto tempo, conferir o cliente no console.
- **Conta nova de sócio:** definir o e-mail e a senha nas variáveis e fazer Redeploy. Contas que já existem não são alteradas.
- **Trocar o e-mail de um sócio:** a própria pessoa troca em **Ajustes → Minha conta** (pede a senha atual). Pela Vercel também dá: mudar `ZRO_VICTOR_EMAIL` ou `ZRO_EDU_EMAIL` e fazer Redeploy; a conta que já existe passa para o e-mail novo (não cria outra). O deploy só aplica a variável quando ela muda, então não desfaz a troca feita no painel.
- **Esqueceu a senha:** em Settings → Environment Variables, criar `ZRO_REDEFINIR_SENHA` = `victor` (ou `edu`) e `ZRO_VICTOR_PASSWORD` (ou `ZRO_EDU_PASSWORD`) com a senha nova (10+ caracteres), e fazer Redeploy. Depois de entrar, apagar as duas variáveis. Cada senha nova só é aplicada uma vez, então um deploy depois não desfaz uma troca feita no painel.

## Custos

- **Vercel:** o plano Hobby (grátis) é só pra uso pessoal e não comercial. Site de empresa, pelos termos da Vercel, pede o **Pro: US$ 20 por mês por membro** (um membro basta).
- **Neon:** plano Free (0,5 GB, sobra para a ZRO). Não pausa: depois de um tempo parado ele "dorme" e acorda sozinho no primeiro acesso (meio segundo a mais). O backup fica em **Ajustes → Dados e backup**. (O Supabase grátis não coube: limite de 2 projetos por conta, e ele pausa após 7 dias sem uso.)
- **Higgsfield e geração de imagem:** não usados. Luz, grão e partículas do site são feitos em código.
- **Google Drive:** nenhum serviço novo. Os arquivos vão do navegador direto para o Google (nada passa pela Vercel) e o espaço é o do Workspace. Limite do Google: 750 GB de envio por dia por conta (se o SOBEDESCE usar a mesma conta, divide o limite).

## Rodar no computador

```bash
npm install
npm run db:reset   # banco local com dados de exemplo (senhas em data/credenciais-dev.txt)
npm run dev        # http://localhost:3000 (sobe junto o banco local; pare o dev antes de db:migrate/db:seed)
```

`npm run db:seed` se recusa a rodar em banco remoto, pra dado de exemplo nunca cair na produção.

### Drive no computador (Google falso)

```bash
node scripts/google-mock/servidor.mjs     # Drive + OAuth falsos em http://127.0.0.1:54400
```

No `.env.local` (nunca versionado):

```
GOOGLE_CLIENT_ID=zro-teste.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-zro-teste
ZRO_GOOGLE_API_BASE=http://127.0.0.1:54400
```

`ZRO_GOOGLE_API_BASE` só vale fora da Vercel e fora de produção. Testes: `npx tsx --conditions=react-server --test scripts/tests/drive-*.test.mts` (Google falso e Postgres em memória, sem tocar no `data/pglite`).
