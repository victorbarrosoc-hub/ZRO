# Drive da ZRO: plano final

Pastas dos projetos, envio de material pelo site (painel, freela e cliente) e área do cliente, tudo no Google Drive da empresa.

- **Fonte da verdade desta entrega.** Substitui o plano anterior de "envio para o Drive". Onde este texto e o plano antigo discordam, vale este.
- **Branch:** `claude/drive-envios` (uma só). Commits e PR ficam com o orquestrador.
- **Quem lê o quê:** o Victor lê a seção 0. Cada engenheiro lê tudo, mas mexe só nos arquivos do seu bloco (seção 12).
- **Referências externas** (só para ler ou copiar a lógica, a ZRO não importa nada delas em produção):
  - `/home/user/baixadordodrive/mobile/lib/uploader.js`: motor de envio do SOBEDESCE, já testado.
  - `/home/user/baixadordodrive/mobile/lib/wakelock.js`: tela acesa.
  - `/home/user/baixadordodrive/test/mock-drive.js`: Drive e OAuth falsos. É **copiado** para `scripts/google-mock/` (seção 13).
  - `/home/user/baixadordodrive/docs/GOOGLE-NOTES.md`: notas verificadas sobre a API.

---

## 0. Para o Victor

### O que passa a existir

- **Pasta de cada projeto, criada sozinha e vazia** quando o projeto nasce (inclusive o que vem de orçamento aprovado):
  ```
  ZRO/Clientes/<Cliente>/<AAAA-MM> · <Projeto>/
    00 Documentos
    01 Cenas
    02 Áudios
    03 Assets/      Do cliente · Trilha e SFX · Gráficos
    04 Projeto/     Edição · Color · Som · Motion
    05 Render
    06 Entregas/    Master · Redes · Legendas
  ZRO/Clientes/<Cliente>/Arquivos da empresa
  ```
  - Projeto antigo: botão **Criar pastas no Drive** na aba Drive do projeto (ou "Criar pastas dos projetos ativos" em Ajustes).
  - Projeto que já tem link do Drive: usa aquela pasta e cria só o que falta.
- **Painel → Arquivos:** você e o Edu navegam no Drive da empresa, criam pastas, sobem arquivos e pastas inteiras (computador ou iPhone, pelo app da tela inicial) e baixam pelo link do próprio Google.
- **Link de envio por diária** (na diária da agenda e na aba Drive do projeto):
  - O freela abre o link no computador, toca no nome dele (vem da escala da diária) e na câmera (Câm A, Câm B, Drone, Gravador…) e escolhe o cartão.
  - Cada cartão vira um **rolo numerado sozinho**: A001, A002 na Câm A; D001 no drone. Áudio vai para a pasta do gravador.
  - Os arquivos do cartão **nunca são renomeados**, e as pastas do cartão ficam como estavam.
  - Destino: `01 Cenas/2026-03-12 · Diária 02/Câm A · Rafael Moura/A003` ou `02 Áudios/2026-03-12 · Diária 02/Zoom F6 · Carla Dias/`.
  - Não precisa de conta Google.
- **Área do cliente** (CRM → cliente → aba Área do cliente): um link por cliente, com senha opcional.
  - O cliente vê os projetos dele e **só** a pasta `06 Entregas` de cada um, e baixa por link do Google.
  - Ele também manda logo, manual de marca e referências, que caem em `03 Assets/Do cliente/<data> · <assunto>` do projeto (ou em "Arquivos da empresa").
  - **Liberar entregas** (aba Drive do projeto): libera o link de download dos finais e, se o cliente tem e-mail no CRM, o próprio Google manda um e-mail com a pasta e o link da área.
- **O que chegou aparece no painel:** de quem, quando, quantos arquivos e quanto pesa (Arquivos, aba Drive do projeto, área do cliente no CRM e histórico do cliente).
- **Nada passa pela Vercel.** Os arquivos vão do navegador direto para o Google. Custo novo: zero.

### O que você faz uma vez (uns 20 minutos)

**1. Google Cloud, projeto próprio "ZRO Site"** (separado do SOBEDESCE)
1. Entre em [console.cloud.google.com](https://console.cloud.google.com) com **contato@dissesim.com.br**.
2. No seletor de projetos, confira que a **organização dissesim.com.br** está escolhida. **Novo projeto** → nome `ZRO Site` → Criar.
   - Se a organização não aparecer, quem administra o Workspace precisa liberar a criação de projetos para essa conta.
3. **APIs e serviços → Biblioteca → Google Drive API → Ativar.**
4. **Google Auth Platform → Branding:** nome `ZRO Site`, e-mail de suporte `contato@dissesim.com.br`, página inicial `https://zrofilmes.vercel.app`, política `https://zrofilmes.vercel.app/privacidade`.
5. **Público-alvo: Interno.** Assim não aparece o aviso de "app não verificado" e a conexão não expira em 7 dias. Só contas de dissesim.com.br conseguem conectar.
6. **Acesso a dados → Adicionar escopos:** `https://www.googleapis.com/auth/drive`.
7. **Clientes → Criar cliente → Aplicativo da Web**, nome `ZRO Site (web)`.
   - **URIs de redirecionamento autorizados:** `https://zrofilmes.vercel.app/api/google/callback` (e `http://localhost:3000/api/google/callback` para testes no computador).
   - **Criar.** Copie o ID e o **segredo na hora** (baixe o JSON: o segredo só aparece uma vez).

**2. Google Workspace (admin.google.com)**, só se algo for bloqueado
- **Apps → Google Workspace → Drive e Documentos → Compartilhamento:** compartilhamento fora de dissesim.com.br **ativado**, com permissão para links "qualquer pessoa com o link". Sem isso, o cliente não baixa pelo link.
- **Segurança → Controles de API → Acesso de apps de terceiros:** se aparecer "acesso bloqueado" ao conectar, marque o app **ZRO Site** como confiável.
- Os nomes no console do Google mudam com frequência. O caminho acima é o de hoje.

**3. Vercel → zrofilmes → Settings → Environment Variables**
- `GOOGLE_CLIENT_ID` (o ID do passo 1.7)
- `GOOGLE_CLIENT_SECRET` (o segredo, tipo **Sensitive**)
- `ZRO_DRIVE_KEY` (tipo **Sensitive**). No Terminal do Mac: `openssl rand -base64 32`. Guarde também no gerenciador de senhas.
- Depois: **Deployments → Redeploy**.

**4. Conectar, no navegador do computador** (não pelo app do iPhone)
- Painel → Ajustes → **Google Drive** → **Conectar Google** → entre com **contato@dissesim.com.br** → permita o acesso ao Drive.

**5. Testar o envio direto**
- No mesmo lugar, **Testar neste aparelho**: no Chrome do computador, no Safari do iPhone e no app da tela inicial.
- Tudo "ok": pronto. Algo "falhou": mande o print. O plano B está na seção 9.

### O que mexe em áreas protegidas do repositório

- **Banco:** 8 tabelas novas (`drive_*`). A migração só acrescenta: nenhuma tabela existente muda. Antes do merge, baixar o backup em Ajustes → Dados.
- **Menu:** item novo "Arquivos". **Ajustes:** aba nova "Google Drive". **Projeto:** aba nova "Drive". **CRM → cliente:** aba nova "Área do cliente". **Agenda:** uma linha nova na janela da diária.
- **Backup:** as tabelas novas entram, sem os segredos.
- **Páginas públicas novas:** `/enviar/<código>` e `/cliente/<código>`, fora da busca do Google, com cabeçalhos de segurança próprios.
- **Privacidade:** texto novo sobre os arquivos recebidos (para você e o Edu revisarem, por causa da LGPD).
- **Não muda:** `src/proxy.ts`, as travas de banco e prévia, o deploy e o backup existente.

### O que preciso que você confirme (os padrões abaixo já valem até você dizer o contrário)

1. **Numeração dos rolos por projeto inteiro**, não por diária: A001…A005 na diária 1, A006 na diária 2. Assim o editor nunca tem dois "A001" no mesmo projeto.
2. **Letras:** A, B, C, E = câmeras; **D = Drone**; **F = Foto**. Áudio não tem rolo.
3. **Nome do cartão:** quando o freela escolhe o cartão inteiro, o conteúdo dele vai direto para dentro de `A003` (como um DIT faz). O nome do cartão ("EOS_DIGITAL") fica anotado na descrição da pasta.
4. **Link da diária:** vale 30 dias depois da diária, sem limite de tamanho (dá para pôr um limite em cada link). **Área do cliente:** sem validade, até 50 GB de envio por dia.
5. **No fim do envio, o freela lê:** "Guarde o cartão até a ZRO confirmar." (e não "pode formatar").
6. **As entregas só aparecem para o cliente depois de "Liberar entregas"** no projeto. Depois disso, tudo o que entrar em `06 Entregas` aparece para ele.

---

## 1. Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| **Transporte** | O servidor abre a sessão retomável mandando o `Origin` do navegador (validado numa lista). O navegador faz os `PUT` dos pedaços direto no Google. O servidor **confere e conclui** (consulta `bytes */T` e `files.get`). | Os bytes nunca passam pela Vercel (4,5 MB por requisição, tráfego cobrado). A pesquisa mostra CORS completo nos 308 de sessões criadas com `Origin`; a resposta final pode vir sem CORS, por isso quem conclui é o servidor. O diagnóstico da seção 9 confirma em cada aparelho. |
| **Relay** | **Não implementado.** Fica só a interface `Transporte` e o texto da seção 9. | 250 GB em pedaços de 4 MiB seriam 62.500 chamadas na Vercel. Só vale construir se o diagnóstico falhar. |
| **Conta e app Google** | Google Workspace dissesim.com.br, conta conectada contato@dissesim.com.br, projeto próprio "ZRO Site", público **Interno**, cliente "Aplicativo da Web". **Nenhum e-mail fixo no código**: a conta vem do `about.get`. | Interno: sem aviso de app não verificado, sem expirar em 7 dias, sem limite de 100 usuários. Projeto separado: a marca da tela de consentimento e uma eventual suspensão não afetam o SOBEDESCE. |
| **Escopo OAuth** | Só `https://www.googleapis.com/auth/drive`. Conferido por igualdade exata na lista devolvida (`scope.split(" ").includes(...)`). | Navegar e baixar pastas que o app não criou exige `drive`. `drive.file` não enxerga nada disso. Substring aceitaria `drive.readonly`. |
| **Segredos** | Refresh token na tabela `drive_conexao`, cifrado com AES-256-GCM e a chave `ZRO_DRIVE_KEY` (variável própria). Token de link guardado como SHA-256 (busca) e cifrado (o painel mostra o link de novo). URI da sessão cifrada e apagada ao concluir. | Reconectar não exige redeploy. Trocar `SESSION_SECRET` não derruba o Drive. Perder a chave só obriga a reconectar e gerar links novos. |
| **Endpoints de envio** | Route handlers com endereço fixo (padrão de `quadro/banco/route.ts`): `/painel/arquivos/api`, `/enviar/<token>/api`, `/cliente/<token>/api`. **Um protocolo só** para os três. | Uma aba aberta antes de um deploy (app do iPhone, envio de 6 horas) continua funcionando. |
| **Lote** | Todo envio é um **lote** (um cartão, uma pasta ou uma seleção). O servidor cria a pasta do lote e o **número do rolo** de forma atômica. Os arquivos sobem dentro dele. | A numeração e as pastas ficam no servidor, nunca no navegador. Reabrir o mesmo cartão retoma o mesmo rolo. |
| **Rolo** | Contador por projeto e por letra, em `drive_projetos.rolos` (jsonb), incrementado com um único `UPDATE … RETURNING`. Formato `A001` (3 dígitos; passa de 999 sem cortar). | Uma linha travada pelo Postgres: dois freelas ao mesmo tempo nunca recebem o mesmo número. Número por projeto evita nomes de rolo repetidos na edição. |
| **Diária NN** | Número da diária congelado na primeira vez em que ela ganha link ou pasta: a posição dela por data entre as diárias do projeto; se o número já estiver em uso, o próximo livre. | O nome da pasta não muda depois de criada, mesmo que a agenda mude. |
| **Nomes** | Pastas criadas pela ZRO: nome limpo para Drive, Mac e Windows. Arquivos e pastas **de dentro do cartão: nunca renomeados**; só caracteres de controle e de direção (bidi) são trocados, e o nome original fica registrado. | Câmeras nunca geram esses caracteres. Um nome com `\u202E` é golpe clássico ("orcamentoexe.pdf"). |
| **Cartão** | Uma pasta só escolhida pelo freela: o conteúdo vai para dentro do rolo, sem o nome da pasta do cartão (que fica na descrição da pasta do rolo e em `drive_lotes.cartaoNome`). Painel e cliente: a pasta escolhida entra inteira. Arquivos de sistema (`.DS_Store`, `._*`, `Thumbs.db`, `.Spotlight-V100`, `.Trashes`, `.fseventsd`, `System Volume Information`, `$RECYCLE.BIN`) não sobem. | É como um DIT descarrega. Os arquivos de sistema não são material. |
| **Download** | Sempre link do próprio Google (`webContentLink` para baixar, `webViewLink` para ver). Nunca bytes pela Vercel. | Custo e limite da Vercel. |
| **Entregas do cliente** | Botão **Liberar entregas** por projeto: permissão "qualquer pessoa com o link: leitor" **só** na pasta `06 Entregas` (os arquivos dentro herdam) e, se houver e-mail no CRM, compartilhamento de leitor com esse e-mail, com aviso do Google. Toda permissão criada fica em `drive_compartilhamentos` para **Recolher** depois. | O Victor decide quando o cliente vê (QC antes). O link de download só aparece dentro da área. |
| **Trava da área do cliente** | O servidor só lista pastas cujos ids estão no banco para projetos daquele cliente. Nenhum id de pasta vem do navegador nas páginas públicas. | Impede ver a pasta de outro cliente trocando um id. |
| **Chaves estrangeiras** | Tudo o que aponta para `projects`, `clients`, `events`, `freelancers`, `users` é `ON DELETE SET NULL`, com cópia do rótulo. | "Dados nunca podem sumir": apagar um projeto não apaga o registro do que chegou. |
| **Prévias** | `src/proxy.ts` não muda (já cobre `/painel`). As rotas novas fora de `/painel` (`/api/google/*`, `/enviar`, `/cliente`) têm guarda própria: redirecionam para o endereço oficial ou dão 404. | Regra do repositório. |
| **Dependências** | Nenhuma nova. `fetch`, `node:crypto`, `jose`, `bcryptjs`, `zod`, `sonner`, `lucide-react`, `motion` já existem. | Estilo enxuto do repositório. |

---

## 2. Fluxo

```
Navegador (painel, freela ou cliente)          ZRO (Vercel gru1)                                   Google
1 POST <rota> {op:"lote", destino, impressao} ─▶ confere acesso, Origin, limites
                                                  pastas: garantirCaminho (cache + trava no banco)
                                                  rolo: UPDATE drive_projetos … RETURNING  (A003)
   ◀── {loteId, rotulo:"A003", caminho}
2 POST {op:"iniciar", loteId, arquivos[≤50]} ──▶  já recebido? retomada? 0 byte?
                                                  POST /upload/drive/v3/files?uploadType=resumable&fields=id
                                                    Authorization: Bearer <token do servidor>
                                                    Origin: <origem validada do navegador>
                                                    X-Upload-Content-Type / X-Upload-Content-Length ─────▶ 200 + Location
                                                  drive_envios (sessão cifrada)
   ◀── [{envioId, sessao, offset}]
3 PUT <sessao> Content-Range: bytes a-b/T  (sem Authorization, pedaços de 256 KiB × n) ─────────────────▶ 308 Range | 200
4 POST {op:"conferir", envioIds} ─────────────▶  PUT <sessao> "bytes */T" (sem token) ─────────────────▶ 308 | 200 {id} | 404
                                                  files.get(id): parents ∋ pasta, size = T, trashed = false
                                                  UPDATE … SET estado='concluido' WHERE estado='enviando' RETURNING
   ◀── [{envioId, estado:"concluido"|"parcial"|"expirado"}]
5 POST {op:"fecharLote", loteId} ─────────────▶  contagens; histórico do CRM uma vez (avisadoEm)
```

- **Painel:** `/painel/arquivos/api` (sessão do painel).
- **Freela:** `/enviar/<token>/api` (o token do link da diária).
- **Cliente:** `/cliente/<token>/api` (token da área + cookie, se tiver senha).
- O navegador nunca recebe token do Google. A URI da sessão só vai na resposta de `iniciar`, para quem pediu.

---

## 3. Modelo de dados (migração só aditiva)

Bloco novo no fim das tabelas de `src/lib/db/schema.ts`, antes de `/* Relações */`. Usa os helpers `id()`, `createdAt()` e `updatedAt()` que já existem, com nomes de campo em português (precedente: `quadro_cards`). O tipo `DiagnosticoRegistro` vem de `@/lib/drive/protocolo` (import de tipo, como o de `domain`).

```ts
/* ============================== Google Drive ==============================
 * Plano: docs/dev/drive.md. Os bytes ficam no Drive; aqui ficam ids, travas e o registro do que chegou.
 * Tudo que aponta para projeto, cliente, diária, freela ou usuário é ON DELETE SET NULL, com cópia do
 * rótulo: apagar no painel nunca apaga o registro do que chegou.
 */
const quando = () => timestamp({ mode: "date", withTimezone: true });

/** Conexão da ZRO com o Google (uma linha, id "zro"). */
export const driveConexao = pgTable("drive_conexao", {
  id: text().primaryKey(),                                   // sempre "zro"
  conta: text(),                                             // e-mail do about.get (nunca fixo no código)
  contaNome: text(),
  escopo: text(),
  refreshTokenEnc: text(),                                   // AES-256-GCM; null = desconectado. FORA do backup
  geracao: integer().notNull().default(1),                   // sobe a cada troca de conta
  raizNome: text().notNull().default("ZRO"),
  raizId: text(),                                            // pasta raiz no Drive conectado
  clientesId: text(),                                        // <raiz>/Clientes
  conectadoPorId: text().references(() => users.id, { onDelete: "set null" }),
  conectadoEm: quando(),
  desconectadoEm: quando(),
  erro: text(),                                              // "reconectar" | null
  erroEm: quando(),
  diagnosticos: jsonb().$type<DiagnosticoRegistro[]>().notNull().default([]), // últimos 12
  atualizadoEm: updatedAt(),
});

/** Cache e trava das pastas criadas pelo app. Uma linha por (conta, pai, nome). */
export const drivePastas = pgTable(
  "drive_pastas",
  {
    id: id(),
    conta: text().notNull(),
    paiId: text().notNull(),
    nome: text().notNull(),                                  // já limpo; casa exato
    pastaId: text(),                                         // null = alguém está criando (trava)
    chave: text(),                                           // nome lógico: "cliente:<id>", "cliente:<id>:empresa"
    criandoDesde: quando(),
    criadoEm: createdAt(),
    atualizadoEm: updatedAt(),
  },
  (t) => [
    uniqueIndex("drive_pastas_pai_nome_idx").on(t.conta, t.paiId, t.nome),
    uniqueIndex("drive_pastas_chave_idx").on(t.conta, t.chave),
    index("drive_pastas_pasta_idx").on(t.pastaId),
  ],
);

/** Estrutura de pastas de cada projeto (as 7 pastas e as subpastas). */
export const driveProjetos = pgTable(
  "drive_projetos",
  {
    id: id(),
    projectId: text().references(() => projects.id, { onDelete: "set null" }),
    clientId: text().references(() => clients.id, { onDelete: "set null" }),
    conta: text().notNull(),
    rotulo: text().notNull(),                                // cópia: "SERHS / 2026-03 · Verão Pipa"
    caminho: text(),                                         // "ZRO / Clientes / SERHS / 2026-03 · Verão Pipa"
    deLink: boolean().notNull().default(false),              // true = pasta veio do driveUrl do projeto
    pastaId: text(),
    pastaUrl: text(),
    documentosId: text(),                                    // 00 Documentos
    cenasId: text(),                                         // 01 Cenas
    audiosId: text(),                                        // 02 Áudios
    assetsId: text(),                                        // 03 Assets
    projetoEdicaoId: text(),                                 // 04 Projeto
    renderId: text(),                                        // 05 Render
    entregasId: text(),                                      // 06 Entregas (a ÚNICA que o cliente vê)
    subpastas: jsonb().$type<Record<string, string>>().notNull().default({}), // "03 Assets/Do cliente": id…
    estado: text().notNull().default("criando"),             // criando | pronta | incompleta | erro
    erro: text(),
    rolos: jsonb().$type<Record<string, number>>().notNull().default({}),    // { "A": 3, "D": 1 }
    entregasLiberadasEm: quando(),
    entregasLiberadasPorId: text().references(() => users.id, { onDelete: "set null" }),
    criadoEm: createdAt(),
    atualizadoEm: updatedAt(),
  },
  (t) => [
    uniqueIndex("drive_projetos_projeto_idx").on(t.projectId, t.conta),
    index("drive_projetos_cliente_idx").on(t.clientId),
  ],
);

/** Diária com número congelado e as pastas dela em 01 Cenas e 02 Áudios. */
export const driveDiarias = pgTable(
  "drive_diarias",
  {
    id: id(),
    eventId: text().references(() => events.id, { onDelete: "set null" }),
    projectId: text().references(() => projects.id, { onDelete: "set null" }),
    driveProjetoId: text().references(() => driveProjetos.id, { onDelete: "set null" }),
    numero: integer().notNull(),
    data: text().notNull(),                                  // AAAA-MM-DD (cópia, do dia em que nasceu)
    nome: text().notNull(),                                  // "2026-03-12 · Diária 02"
    cenasPastaId: text(),                                    // criada no primeiro rolo de vídeo
    audiosPastaId: text(),                                   // criada no primeiro envio de áudio
    criadoEm: createdAt(),
  },
  (t) => [
    uniqueIndex("drive_diarias_evento_idx").on(t.eventId, t.driveProjetoId),
    uniqueIndex("drive_diarias_numero_idx").on(t.driveProjetoId, t.numero),
  ],
);

/** Links públicos: um por diária (freela) e um por cliente (área). Nunca apagados: desativar = revogadoEm. */
export const driveLinks = pgTable(
  "drive_links",
  {
    id: id(),
    tipo: text().notNull(),                                  // "freela-diaria" | "cliente-area"
    tokenHash: text().notNull(),                             // sha256 hex do token (fica no backup)
    tokenEnc: text(),                                        // token cifrado, para mostrar o link de novo. FORA do backup
    senhaHash: text(),                                       // bcrypt (hashPassword), opcional. FORA do backup
    senhaVersao: integer().notNull().default(0),             // muda ao trocar/tirar a senha: derruba cookies
    eventId: text().references(() => events.id, { onDelete: "set null" }),
    diariaId: text().references(() => driveDiarias.id, { onDelete: "set null" }),
    projectId: text().references(() => projects.id, { onDelete: "set null" }),
    clientId: text().references(() => clients.id, { onDelete: "set null" }),
    rotulo: text().notNull(),                                // cópia: "Verão Pipa · Diária 02 · 12/03/2026" | "SERHS"
    expiraEm: quando(),                                      // null = sem validade
    limiteBytes: bigint({ mode: "number" }),                 // freela: total do link; cliente: por dia. null = sem limite
    revogadoEm: quando(),
    revogadoPorId: text().references(() => users.id, { onDelete: "set null" }),
    criadoPorId: text().references(() => users.id, { onDelete: "set null" }),
    ultimoUsoEm: quando(),
    criadoEm: createdAt(),
    atualizadoEm: updatedAt(),
  },
  (t) => [
    uniqueIndex("drive_links_token_idx").on(t.tokenHash),
    uniqueIndex("drive_links_diaria_ativa_idx").on(t.eventId).where(sql`${t.revogadoEm} is null and ${t.tipo} = 'freela-diaria'`),
    uniqueIndex("drive_links_area_ativa_idx").on(t.clientId).where(sql`${t.revogadoEm} is null and ${t.tipo} = 'cliente-area'`),
    index("drive_links_projeto_idx").on(t.projectId),
  ],
);

/** Um envio de cartão, pasta ou seleção. O rolo e a pasta de destino nascem aqui. */
export const driveLotes = pgTable(
  "drive_lotes",
  {
    id: id(),
    origem: text().notNull(),                                // "painel" | "freela" | "cliente"
    linkId: text().references(() => driveLinks.id, { onDelete: "set null" }),
    userId: text().references(() => users.id, { onDelete: "set null" }),
    projectId: text().references(() => projects.id, { onDelete: "set null" }),
    clientId: text().references(() => clients.id, { onDelete: "set null" }),
    eventId: text().references(() => events.id, { onDelete: "set null" }),
    diariaId: text().references(() => driveDiarias.id, { onDelete: "set null" }),
    driveProjetoId: text().references(() => driveProjetos.id, { onDelete: "set null" }),
    freelancerId: text().references(() => freelancers.id, { onDelete: "set null" }),
    pessoaNome: text(),                                      // cópia do cadastro ("Rafael Moura") ou digitado
    fonte: text(),                                           // "cam-a"…"foto" | "gravador" | null
    gravador: text(),                                        // "Zoom F6"
    rolo: text(),                                            // "A003" | null
    rotulo: text().notNull(),                                // "A003 · Câm A · Rafael Moura" | "Manual de marca" | "Brutos"
    assunto: text(),                                         // cliente
    cartaoNome: text(),                                      // pasta escolhida ("EOS_DIGITAL"), só registro
    impressao: text(),                                       // sha256 de "caminho/nome|tamanho" ordenados
    pastaId: text().notNull(),                               // destino do lote
    caminho: text().notNull(),                               // caminho legível até o destino
    arquivosPrevistos: integer().notNull().default(0),
    bytesPrevistos: bigint({ mode: "number" }).notNull().default(0),
    arquivosRecebidos: integer().notNull().default(0),
    bytesRecebidos: bigint({ mode: "number" }).notNull().default(0),
    estado: text().notNull().default("aberto"),              // aberto | concluido | parcial | cancelado
    consentimentoEm: quando(),                               // cliente (LGPD)
    avisadoEm: quando(),                                     // histórico do CRM gravado (trava contra duplicar)
    vistoEm: quando(),                                       // o painel já mostrou (ponto de "novo")
    ultimoSinalEm: quando(),
    concluidoEm: quando(),
    criadoEm: createdAt(),
    atualizadoEm: updatedAt(),
  },
  (t) => [
    index("drive_lotes_criado_idx").on(t.criadoEm),
    index("drive_lotes_projeto_idx").on(t.projectId, t.criadoEm),
    index("drive_lotes_link_idx").on(t.linkId, t.criadoEm),
    index("drive_lotes_cliente_idx").on(t.clientId, t.criadoEm),
  ],
);

/** Cada arquivo de um lote. Linha enxuta: o resto vem do lote. */
export const driveEnvios = pgTable(
  "drive_envios",
  {
    id: id(),                                                // vai em appProperties.zroEnvio no Drive
    loteId: text().references(() => driveLotes.id, { onDelete: "set null" }),
    pastaId: text().notNull(),                               // pasta final (com as subpastas do cartão)
    caminhoRelativo: text().notNull().default(""),           // "DCIM/100CANON" dentro do lote
    nome: text().notNull(),                                  // nome gravado no Drive
    nomeOriginal: text(),                                    // só quando precisou trocar controle/bidi
    tipo: text().notNull(),                                  // MIME (octet-stream se suspeito)
    tamanho: bigint({ mode: "number" }).notNull(),
    modificado: bigint({ mode: "number" }),                  // lastModified (ms), desempate fora do WebKit
    estado: text().notNull().default("enviando"),            // enviando | concluido | falhou | cancelado | expirado
    sessaoEnc: text(),                                       // URI cifrada; null ao concluir/cancelar/expirar. FORA do backup
    sessaoExpiraEm: quando(),                                // criação + 6 dias (o Google guarda 7)
    sessaoHost: text(),                                      // só o host, para o diagnóstico
    arquivoId: text(),                                       // id no Drive: vem da sessão, nunca do navegador
    md5: text(),
    erro: text(),
    ultimoSinalEm: quando(),
    concluidoEm: quando(),
    criadoEm: createdAt(),
  },
  (t) => [
    index("drive_envios_lote_idx").on(t.loteId, t.estado),
    index("drive_envios_pasta_nome_idx").on(t.pastaId, t.nome),
    index("drive_envios_ativos_idx").on(t.ultimoSinalEm).where(sql`${t.estado} = 'enviando'`),
  ],
);

/** Permissões que o app criou no Drive (para poder recolher). */
export const driveCompartilhamentos = pgTable(
  "drive_compartilhamentos",
  {
    id: id(),
    motivo: text().notNull(),                                // "entregas" | "equipe"
    arquivoId: text().notNull(),                             // pasta ou arquivo no Drive (ex.: 06 Entregas)
    permissaoId: text(),                                     // devolvido por permissions.create; null = falhou
    tipo: text().notNull(),                                  // "anyone" | "user"
    papel: text().notNull(),                                 // "reader" | "writer"
    email: text(),
    avisouPorEmail: boolean().notNull().default(false),
    projectId: text().references(() => projects.id, { onDelete: "set null" }),
    clientId: text().references(() => clients.id, { onDelete: "set null" }),
    driveProjetoId: text().references(() => driveProjetos.id, { onDelete: "set null" }),
    erro: text(),
    criadoPorId: text().references(() => users.id, { onDelete: "set null" }),
    criadoEm: createdAt(),
    revogadoEm: quando(),
    revogadoPorId: text().references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("drive_compart_projeto_idx").on(t.projectId),
    index("drive_compart_arquivo_idx").on(t.arquivoId),
  ],
);
```

### Relações

- Nenhum `relations()` existente muda. As consultas novas usam `where` explícito.
- Opcional: objetos `relations()` só para as tabelas novas.

### Migração

1. `npx drizzle-kit generate --name drive`. Resultado: `drizzle/0008_drive.sql`, `drizzle/meta/0008_snapshot.json` e a entrada no `_journal.json`.
2. Revise o SQL à mão. Só pode ter `CREATE TABLE`, `CREATE INDEX`, `CREATE UNIQUE INDEX` (com `WHERE` nos parciais) e `ALTER TABLE "drive_…" ADD CONSTRAINT … FOREIGN KEY`.
3. Confira (precisa voltar **vazio**):
   ```
   grep -nE 'ALTER TABLE|DROP|RENAME' drizzle/0008_drive.sql | grep -vE 'ALTER TABLE "drive_[a-z_]+" ADD CONSTRAINT'
   ```
4. A migração roda sozinha no deploy (`db-setup.mts`). Se falhar, o deploy para e o site continua no ar.

### Backup (`src/lib/queries/backup.ts`, bloco PAINEL)

- `driveProjetos`, `driveDiarias`, `drivePastas`, `driveLotes`, `driveCompartilhamentos` entram inteiros em `TABLES`, **depois** de `projects`, `events`, `clients`, `freelancers` e `users`.
- As três com segredo saem com `getTableColumns()`, depois do laço (precedente de `tables.users`):
  ```ts
  const { refreshTokenEnc: _r, ...conexao } = getTableColumns(s.driveConexao);
  tables.driveConexao = await db.select(conexao).from(s.driveConexao);
  const { tokenEnc: _t, senhaHash: _p, ...links } = getTableColumns(s.driveLinks);   // tokenHash FICA (NOT NULL; não é segredo)
  tables.driveLinks = await db.select(links).from(s.driveLinks);
  const { sessaoEnc: _s, ...envios } = getTableColumns(s.driveEnvios);
  tables.driveEnvios = await db.select(envios).from(s.driveEnvios);
  ```
- Comentário do topo: "Fora: senhas, tentativas de login e os segredos do Google (refresh token, token cifrado dos links, senha dos links, URI das sessões)". `versao` continua `1` (só acrescenta).

### Limpeza dos exemplos (`ajustes/demo-data.ts`, bloco PAINEL)

Os exemplos não criam linhas `drive_*` (apontariam para pastas que não existem). No passo 1 de `DEMO_CLEANUP`, antes dos `delete`, entram:

```sql
-- links que levam a exemplos param de funcionar
update drive_links set revogado_em = now() where revogado_em is null and (project_id like 'demo-%' or client_id like 'demo-%' or event_id in (EVENTS_OUT))
-- e todo vínculo com exemplo vira null (o comentário do arquivo pede não depender das FKs)
update drive_projetos set project_id = null where project_id like 'demo-%'
update drive_projetos set client_id  = null where client_id  like 'demo-%'
update drive_diarias  set event_id = null where event_id in (EVENTS_OUT)
update drive_diarias  set project_id = null where project_id like 'demo-%'
update drive_links    set event_id = null where event_id in (EVENTS_OUT)
update drive_links    set project_id = null where project_id like 'demo-%'
update drive_links    set client_id  = null where client_id  like 'demo-%'
update drive_lotes    set project_id = null where project_id like 'demo-%'
update drive_lotes    set client_id  = null where client_id  like 'demo-%'
update drive_lotes    set event_id = null where event_id in (EVENTS_OUT)
update drive_lotes    set freelancer_id = null where freelancer_id like 'demo-%'
update drive_compartilhamentos set project_id = null where project_id like 'demo-%'
update drive_compartilhamentos set client_id  = null where client_id  like 'demo-%'
```

(`EVENTS_OUT` é a constante que já existe no arquivo. As linhas novas não têm `id` `demo-…`, então não há `and id not like` aqui.)

### Exclusões no painel (bloco PAINEL)

Antes do `delete`, na mesma action, revogar os links que deixariam de fazer sentido (nunca apagar):
- `deleteProject` (`projetos/actions.ts`): `revogarLinksDe({ projectId })`.
- `deleteEvent` (`agenda/actions.ts`): `revogarLinksDe({ eventId })`.
- `deleteClient` (`crm/actions.ts`): `revogarLinksDe({ clientId })`.
- Envios em andamento **continuam** até o fim (a sessão vale; `conferir` funciona com link revogado). Nada some do Drive.

### O que não muda

`summary.ts` (`COUNTED`), `defaults.ts`/`DEFAULT_SETTINGS`, `scripts/lib/base-data.ts`, `scripts/db-setup.mts`, `src/lib/db/config.ts`, `src/proxy.ts`.

### Crescimento do banco

Uma linha de `drive_envios` ocupa uns 350 bytes com índices. Um cartão de fotos com 2.000 arquivos ≈ 0,7 MB. O Neon Free tem 0,5 GB: dá folga para anos de vídeo, mas um ano inteiro de foto pesada chegaria perto. Fica nas pendências (seção 14).

---

## 4. Camada Google (`server-only`, `fetch`, sem SDK)

### Arquivos

| Arquivo | Conteúdo |
|---|---|
| `src/lib/google/config.ts` | `googleConfigurado(): { ok: boolean; faltam: string[] }` (confere `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ZRO_DRIVE_KEY` **sem lançar**), `credenciais()` (lança `GoogleError("sem_config")`), `REDIRECT_URI = ${SITE_URL}/api/google/callback`, `DRIVE_SCOPE`, `endpoints()`, `origensPermitidas()`, `sessaoPermitida(url)`. |
| `src/lib/google/cripto.ts` | `selar(texto, contexto)`, `abrir(selado, contexto)` (lança `ChaveErrada`), `novoToken()`, `hashToken(token)`, `chaveDerivada(info)` (HKDF de `SESSION_SECRET` para cookies). |
| `src/lib/google/oauth.ts` | `pkce()`, `urlDeConsentimento({ state, desafio })`, `trocarCodigo(code, verificador)`, `renovarAcesso(refresh)` (`invalid_grant` → `GoogleError("reconectar")`), `revogar(token)`. |
| `src/lib/google/conexao.ts` | `statusDrive()`, `driveConectado()`, `contaAtual()`, `salvarConexao()`, `desconectar(userId)`, `tokenDeAcesso()`, `esquecerToken()`, `registrarDiagnostico()`. |
| `src/lib/google/drive.ts` | Cliente Drive (tabela abaixo). |
| `src/lib/google/erros.ts` (puro) | `class GoogleError { status; motivo; detalhe? }`, `deResposta(status, json)`, `redigir(texto)` (apaga `upload_id=…`, `Bearer …`, `code=…`, `refresh_token`). |
| `src/lib/google/previa.ts` | `OFFICIAL_URL` (mesma regra do proxy, sem importá-lo), `ehPrevia()`, `paraOficial(request)`: `Response` 307 para o endereço oficial ou `null`. |
| `src/lib/drive/nomes.ts` (puro) | Nomes e ids (abaixo). |
| `src/lib/drive/estrutura.ts` (puro) | `ESTRUTURA`, `FONTES`, nomes das pastas (abaixo). |

### `config.ts`

- **`endpoints()`** (função, não constante, para os testes trocarem o ambiente):
  - produção: `auth=https://accounts.google.com/o/oauth2/v2/auth`, `token=https://oauth2.googleapis.com/token`, `revoke=https://oauth2.googleapis.com/revoke`, `drive=https://www.googleapis.com/drive/v3`, `upload=https://www.googleapis.com/upload/drive/v3`.
  - `ZRO_GOOGLE_API_BASE` só vale com `process.env.VERCEL !== "1"` **e** `NODE_ENV !== "production"` (o segredo do cliente e o refresh token iriam para essa base). Com ela: `${base}/o/oauth2/v2/auth`, `${base}/token`, `${base}/revoke`, `${base}/drive/v3`, `${base}/upload/drive/v3` (caminhos do mock).
- **`origensPermitidas()`:** sem repetição, `SITE_URL`, `OFFICIAL_URL`, `https://zrofilmes.vercel.app`; fora da Vercel, também `http://localhost:3000` e `http://127.0.0.1:3000`.
- **`sessaoPermitida(url)`:** só `https://www.googleapis.com/upload/drive/v3/files?…upload_id=…` (ou a base do mock, nas mesmas condições). O servidor confere isso **antes** de qualquer `PUT`/`DELETE` numa URI decifrada.

### `cripto.ts`

- Formato `v1.<iv>.<cifra>.<tag>` em base64url, AES-256-GCM, IV de 12 bytes.
- **AAD = contexto:** `drive_conexao.refresh:zro`, `drive_envios.sessao:<id>`, `drive_links.token:<id>`. Impede trocar a cifra de uma linha pela de outra.
- Chave: `ZRO_DRIVE_KEY` em base64, precisa dar exatamente 32 bytes. Sem a variável:
  - em dev, `sha256("zro-dev-drive-key")`;
  - em produção, **só `selar`/`abrir` lançam** ("Defina ZRO_DRIVE_KEY…"). Nada lança no import: Ajustes, backup e projeto continuam abrindo.
- `novoToken()`: `randomBytes(32)` em base64url (43 caracteres). `hashToken()`: sha256 hex.
- `chaveDerivada(info)`: `hkdfSync("sha256", SESSION_SECRET (ou o segredo de dev do jwt.ts), "", info, 32)`. Usos: `"zro:google-oauth"` (cookie do OAuth), `"zro:area-cliente"` (cookie da área).

### `oauth.ts`

- Consentimento: `response_type=code`, `scope=DRIVE_SCOPE`, `access_type=offline`, `prompt=consent`, `include_granted_scopes=false`, `code_challenge_method=S256`, `state`. Sem `login_hint` (nenhum e-mail fixo).
- `trocarCodigo` manda `client_secret` e `code_verifier`. Devolve `{ refresh, acesso, expiraEm, escopo }`.

### `conexao.ts`

```ts
export type StatusDrive =
  | { estado: "sem-config"; faltam: string[] }
  | { estado: "desconectado" }
  | { estado: "reconectar"; conta: string | null }
  | { estado: "conectado"; conta: string; nome: string | null;
      raiz: { id: string; nome: string; url: string } | null;
      espaco: { usado: number; limite: number | null } | null };      // limite null = espaço do Workspace sem teto informado
export async function statusDrive(opcoes?: { espaco?: boolean }): Promise<StatusDrive>;   // DTO sem segredo; espaço com cache de 60 s
export async function driveConectado(): Promise<boolean>;                                // só banco, rápido
export async function contaAtual(): Promise<{ conta: string; geracao: number } | null>;
export async function tokenDeAcesso(): Promise<string>;
export function esquecerToken(): void;
```

- **`tokenDeAcesso()`:** cache em memória por instância até `exp − 60 s`; uma renovação por vez (promise compartilhada). Em `invalid_grant`: grava `erro='reconectar'` e `erroEm`, **não** apaga a cifra (reconectar sobrescreve).
- **`salvarConexao({ refresh, conta, nome, escopo, userId, trocar })`:** cifra e grava. Se `trocar`: `geracao + 1`, `raizId` e `clientesId` voltam a null (a raiz é recriada na conta nova).
- **`desconectar(userId)`:** `revogar` (sem quebrar se falhar), `refreshTokenEnc=null`, `desconectadoEm`, `esquecerToken()`.

### `drive.ts`

Todas recebem e devolvem DTOs. Ids vindos de fora passam por `idDriveValido()` e vão com `encodeURIComponent`.

| Função | Detalhe |
|---|---|
| `driveFetch(caminho, init)` | Põe o Bearer, `supportsAllDrives=true`. 401: `esquecerToken()` e uma nova tentativa. 5xx, 429, 403 `rateLimitExceeded`: 3 tentativas com recuo exponencial e jitter. Nunca loga corpo, token nem URI. Log: `console.error("[drive]", motivo, status)`. |
| `sobre()` | `about?fields=user(emailAddress,displayName),storageQuota` → `{ email, nome, usado, limite }`. |
| `arquivo(id, campos?)` | Padrão: `id,name,mimeType,size,md5Checksum,parents,trashed,webViewLink,webContentLink,capabilities(canAddChildren)`. |
| `listarPasta(pastaId, pagina?)` | `q="'<id>' in parents and trashed=false"`, `orderBy=folder,name_natural`, `pageSize=200`, `includeItemsFromAllDrives=true`, `fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink)` → `{ itens: ItemDrive[]; proxima }`. |
| `caminhoDaPasta(id)` | Sobe pelos `parents` até a raiz (máx. 12 níveis) → `[{ id, nome }]`. |
| `listarDrivesCompartilhados()` | `drives?pageSize=100`. |
| `acharPastas(nome, paiId)` | `name='<escapado>' and '<pai>' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`, `orderBy=createdTime`. |
| `criarPasta(nome, paiId, descricao?)` | `files.create` com `mimeType` de pasta. |
| `criarVazio(nome, paiId, propriedades)` | Arquivo de 0 byte: `files.create` só com metadados (o Google não aceita sessão vazia de forma confiável). |
| `abrirSessao({ nome, tipo, tamanho, paiId, origem, envioId, descricao? })` | `POST {upload}/files?uploadType=resumable&supportsAllDrives=true&fields=id`. Cabeçalhos: `Authorization`, `Content-Type: application/json; charset=UTF-8`, `X-Upload-Content-Type: tipo`, `X-Upload-Content-Length: tamanho`, **`Origin: origem`**. Corpo: `{ name, parents:[paiId], appProperties:{ zroEnvio: envioId } }` (**sem `mimeType`** no corpo). Lê o `Location`, confere com `sessaoPermitida`. Devolve `{ sessao, host }`. |
| `consultarSessao(sessao, total)` | `PUT` sem token, `Content-Range: bytes */T`, `Content-Length: 0` → `{ estado:"concluido", id }` (200/201) · `{ estado:"parcial", offset }` (308; sem `Range` = 0, porque o servidor lê todos os cabeçalhos) · `{ estado:"morta" }` (404/410). |
| `cancelarSessao(sessao)` | `DELETE`; ignora erro. |
| `acharPorEnvio(envioId, paiId)` | `appProperties has { key='zroEnvio' and value='<id>' } and '<pai>' in parents and trashed=false`. Reserva: `name='…' and '<pai>' in parents` com tamanho igual. |
| `lixeira(id)` | Só o diagnóstico usa. Nunca apagar de vez. |
| `criarPermissao({ arquivoId, tipo, papel, email?, avisar?, mensagem? })` | `permissions.create` (`sendNotificationEmail`, `emailMessage`; `allowFileDiscovery=false` em `anyone`). Devolve o id. |
| `removerPermissao(arquivoId, permissaoId)` | `permissions.delete`; 404 conta como removida. |
| `linkPasta(id)`, `linkArquivo(id)` | URLs do Drive. |

```ts
export type ItemDrive = { id: string; nome: string; pasta: boolean; tipo: string; tamanho: number | null;
  modificadoEm: string | null; verUrl: string; baixarUrl: string | null };   // baixarUrl = webContentLink (null em pasta e Google Docs)
```

**Erros mapeados** (`deResposta`): `storageQuotaExceeded` → `sem_espaco`; `userRateLimitExceeded` depois das tentativas → `limite_diario`; `notFound` no pai → `pasta`; `insufficientFilePermissions`/`forbidden` → `sem_permissao`; `publishOutNotPermitted`, `cannotShareTeamDriveWithNonGoogleAccounts`, `invalidSharingRequest` → `compartilhamento_bloqueado`; `invalid_grant` → `reconectar`; rede → `rede`; o resto → `google`.

### `nomes.ts` (puro, testado)

- `limparControles(s)`: tira `\u0000-\u001F`, `\u007F`, os de direção `\u200E \u200F \u202A-\u202E \u2066-\u2069` e `\uFEFF`. Devolve `{ nome, mudou }`.
- `nomeDeArquivo(nome)`: **só** `limparControles`. Vazio vira `"arquivo"`. Nunca muda mais nada (arquivos do cartão não são renomeados).
- `nomePasta(nome, max = 120)`: NFC, `limparControles`, troca `/ \ : * ? " < > |` por `-`, junta espaços, tira pontos e espaços das pontas, corta em `max`, nome reservado do Windows (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) ganha `_`. Vazio vira `"Sem nome"`.
- `segmentosDoCaminho(caminho)`: divide por `/`, tira vazios, `.` e `..`, aplica `limparControles` em cada um, máximo 32 níveis.
- `ehLixoDoSistema(caminhoCompleto)`: a lista da seção 1.
- `escaparConsulta(v)`: `\` → `\\`, `'` → `\'`.
- `idDriveValido(id)`: `/^[A-Za-z0-9_-]{10,128}$/` ou `"root"`.
- `idDePastaDoLink(url)`: `/folders\/([A-Za-z0-9_-]+)/` (cobre `/u/N/` e `?usp=sharing`) ou `?id=`; resultado passa por `idDriveValido`.
- `tipoSeguro(t)`: `/^[\w.+-]+\/[\w.+-]+$/`; `application/vnd.google-apps.*` ou inválido → `application/octet-stream`.

### `estrutura.ts` (puro, testado)

```ts
export const ESTRUTURA = [
  { chave: "documentos", nome: "00 Documentos" },
  { chave: "cenas",      nome: "01 Cenas" },
  { chave: "audios",     nome: "02 Áudios" },
  { chave: "assets",     nome: "03 Assets",   sub: ["Do cliente", "Trilha e SFX", "Gráficos"] },
  { chave: "projetoEdicao", nome: "04 Projeto", sub: ["Edição", "Color", "Som", "Motion"] },
  { chave: "render",     nome: "05 Render" },
  { chave: "entregas",   nome: "06 Entregas", sub: ["Master", "Redes", "Legendas"] },
] as const;
export const CLIENTES = "Clientes", SEM_CLIENTE = "Sem cliente", ARQUIVOS_DA_EMPRESA = "Arquivos da empresa", DO_CLIENTE = "03 Assets/Do cliente";

export const FONTES = [
  { chave: "cam-a", rotulo: "Câm A", letra: "A", tipo: "video" },
  { chave: "cam-b", rotulo: "Câm B", letra: "B", tipo: "video" },
  { chave: "cam-c", rotulo: "Câm C", letra: "C", tipo: "video" },
  { chave: "drone", rotulo: "Drone", letra: "D", tipo: "video" },
  { chave: "cam-e", rotulo: "Câm E", letra: "E", tipo: "video" },
  { chave: "foto",  rotulo: "Foto",  letra: "F", tipo: "video" },     // vai para 01 Cenas, com rolo F001
  { chave: "gravador", rotulo: "Gravador", letra: null, tipo: "audio" },
] as const;

nomePastaProjeto(mes /* "2026-03" */, titulo)  → "2026-03 · Verão Pipa"
nomeDiaria(data, numero)                       → "2026-03-12 · Diária 02"
nomePastaCamera(fonte, pessoa)                 → "Câm A · Rafael Moura"
nomePastaGravador(gravador, pessoa)            → "Zoom F6 · Carla Dias"
rotuloRolo(letra, n)                           → "A003" (n > 999 → "A1000")
nomePastaAssunto(data, assunto)                → "2026-03-13 · Manual de marca"
```

O mês do projeto vem de `startDate` (texto `AAAA-MM-DD`) ou de `todayISO()`. Todos os nomes passam por `nomePasta`.

### Pastas: `src/lib/services/drive-pastas.ts` (idempotente, com cache e trava)

```ts
export async function garantirPasta(paiId: string, nome: string, opcoes?: { chave?: string; descricao?: string }): Promise<string>;
export async function garantirCaminho(paiId: string, nomes: string[]): Promise<string>;
export async function garantirRaiz(): Promise<{ raizId: string; clientesId: string }>;
export async function garantirPastasDoProjeto(projectId: string, opcoes?: { userId?: string; verificar?: boolean; ignorarLinkAntigo?: boolean }): Promise<ResultadoPastas>;
export async function agendarPastasDoProjeto(projectId: string): Promise<void>;   // nunca lança
export async function pastasDoProjeto(projectId: string): Promise<DriveProjetoDTO | null>;
export async function garantirPastaDoCliente(clientId: string | null): Promise<string>;
export async function garantirArquivosDaEmpresa(clientId: string): Promise<string>;
export async function diariaDoEvento(eventId: string, opcoes: { criarPastas?: "cenas" | "audios" }): Promise<DiariaDTO>;
export async function esquecerPasta(pastaId: string): Promise<void>;

type ResultadoPastas =
  | { ok: true; driveProjetoId: string; pastaId: string; criadas: number }
  | { ok: false; erro: "sem_google" | "reconectar" | "link_de_fora" | "google"; mensagem: string };
export type DriveProjetoDTO = {
  id: string; estado: "criando" | "pronta" | "incompleta" | "erro"; erro: string | null;
  contaAntiga: boolean; deLink: boolean; pastaId: string | null; pastaUrl: string | null; caminho: string | null;
  pastas: { chave: string; nome: string; id: string | null; url: string | null }[];   // as 7 + subpastas, na ordem
  entregasLiberadasEm: Date | null;
};
export type DiariaDTO = { id: string; numero: number; nome: string; data: string; cenasPastaId: string | null; audiosPastaId: string | null };
```

**`garantirPasta(paiId, nome)`**
1. Lê `drive_pastas` por `(conta, paiId, nome)` (ou por `chave`). Com `pastaId`: devolve (cache).
2. `INSERT … (criandoDesde=now) ON CONFLICT DO NOTHING RETURNING id`.
   - Ganhou a linha: procura no Drive (`acharPastas`); achou, usa a **mais antiga**; não achou, `criarPasta`. Grava `pastaId`.
   - Perdeu (outra requisição está criando): relê a cada 300 ms, até 10 vezes. Se `criandoDesde` tiver mais de 30 s (quem criava caiu), assume com `UPDATE … WHERE pastaId IS NULL AND criandoDesde < now() - interval '30 seconds' RETURNING` e volta ao passo da busca.
3. Um 404 no pai durante um envio chama `esquecerPasta` (apaga só a linha do cache; nada muda no Drive) e o passo é refeito uma vez.

**`garantirPastasDoProjeto(projectId)`**
1. Sem conexão: `sem_google`. Conta atual = `contaAtual()`.
2. `INSERT drive_projetos (projectId, conta, estado='criando', rotulo) ON CONFLICT DO NOTHING`; relê a linha.
3. Pasta do projeto:
   - **A linha já tem `pastaId`:** usa ela (o `driveUrl` que a própria ZRO gravou aponta para a mesma pasta).
   - **Troca de conta** ("Criar na conta atual", `opcoes.ignorarLinkAntigo`): se o `driveUrl` aponta para a `pastaId` da linha da conta antiga, ele é ignorado, a árvore padrão nasce na conta nova e o `driveUrl` passa a apontar para ela (só nesse caso ele é sobrescrito, porque era da ZRO).
   - **`projects.driveUrl` preenchido:** `idDePastaDoLink` → `arquivo()`; precisa ser pasta, fora da lixeira e com `capabilities.canAddChildren`. Serve: usa ela (`deLink=true`). Não serve: `estado='erro'`, `link_de_fora`, mensagem "O link do Drive do projeto não abre na conta conectada. Corrija o link ou apague para criar a pasta padrão." **Nunca cria uma segunda árvore em silêncio.**
   - **Vazio:** `garantirRaiz()` → `garantirPastaDoCliente(clientId)` (chave `cliente:<id>`, ou "Sem cliente") → `garantirPasta(cliente, nomePastaProjeto(mes, titulo))`. Grava `projects.driveUrl` **só se ainda estiver vazio** (`UPDATE … WHERE drive_url IS NULL`).
4. As 7 pastas e as subpastas com `garantirPasta`, uma por vez. Ids em `drive_projetos` (colunas e `subpastas`).
5. `estado='pronta'`; se alguma falhou, `incompleta` com a mensagem. Chamar de novo completa o que falta (idempotente).
6. **Verificação** (`verificar: true`, só pelo botão "Recriar o que falta"): `arquivo(id)` em cada id guardado; o que estiver na lixeira ou sumido sai do cache e é recriado.

**`agendarPastasDoProjeto(projectId)`** (chamada por `createProject`): se `driveConectado()`, insere a linha `criando` (rápido, aguardado) e agenda o resto com `after()` de `next/server`. Erro vira `estado='erro'`, nunca exceção. A aba Drive do projeto atualiza sozinha enquanto estiver `criando`.

**`diariaDoEvento(eventId)`**: a diária precisa ter projeto. Garante a árvore do projeto, depois a linha de `drive_diarias` (número congelado: posição por `(date, createdAt, id)` entre as diárias do projeto; se já usado, `max + 1`; conflito de índice único → relê). Cria `cenasPastaId` ou `audiosPastaId` só quando pedido (sem pasta vazia de áudio quando não houve áudio).

**Troca de conta:** toda leitura de `drive_pastas` e `drive_projetos` filtra por `conta = contaAtual().conta`. Linhas da conta antiga ficam como registro (`contaAntiga: true` no DTO) e a árvore é recriada na conta nova quando for usada.

### Permissões: `src/lib/services/drive-entregas.ts`

```ts
export async function liberarEntregas(projectId: string, userId: string): Promise<
  { ok: true; publico: boolean; emailAvisado: string | null; areaCriada: boolean } | { ok: false; mensagem: string }>;
export async function recolherEntregas(projectId: string, userId: string): Promise<{ ok: true; removidas: number } | { ok: false; mensagem: string }>;
export async function compartilhamentosDoProjeto(projectId: string): Promise<CompartilhamentoDTO[]>;
export async function entregasDoProjeto(driveProjetoId: string): Promise<EntregaArquivo[]>;
export async function darAcessoEquipe(email: string, userId: string): Promise<{ ok: true } | { ok: false; mensagem: string }>;
export async function tirarAcessoEquipe(compartilhamentoId: string, userId: string): Promise<void>;
export type EntregaArquivo = { id: string; nome: string; secao: "Master" | "Redes" | "Legendas" | null; caminho: string;
  tamanho: number | null; modificadoEm: string | null; baixarUrl: string | null; verUrl: string };
export type CompartilhamentoDTO = { id: string; motivo: "entregas" | "equipe"; tipo: "anyone" | "user"; papel: string;
  email: string | null; avisouPorEmail: boolean; criadoEm: Date; revogadoEm: Date | null; erro: string | null };
```

- **`liberarEntregas`:**
  1. Garante a árvore e a área do cliente (cria sem senha se não existir: `areaCriada`).
  2. Se não houver permissão `anyone` ativa registrada para `entregasId`: `criarPermissao({ tipo:"anyone", papel:"reader" })` e registra.
  3. Se o cliente tem e-mail no CRM e não há permissão `user` ativa para ele: `criarPermissao({ tipo:"user", papel:"reader", email, avisar:true, mensagem })` e registra (`avisouPorEmail=true`).
  4. Grava `entregasLiberadasEm/PorId` e o histórico ("Entregas liberadas para o cliente. contato@serhs.com.br avisado pelo Google.").
  5. Erro de compartilhamento bloqueado: guarda `erro` na linha e devolve "O Google Workspace bloqueou o link público. Veja Ajustes → Google Drive." Nada parcial fica escondido: o que deu certo continua registrado.
- **Mensagem do e-mail** (texto puro, ≤ 400 caracteres), 3 variações:
  1. **"Olá. Os arquivos finais de <Projeto> estão nesta pasta. Tudo do seu projeto com a ZRO também fica na sua área: <url>"** (escolhida: diz o que é e onde mais encontrar, sem floreio)
  2. "Os arquivos finais de <Projeto> chegaram. Baixe por aqui ou pela sua área na ZRO: <url>"
  3. "Entrega de <Projeto>. Os arquivos estão nesta pasta e na sua área da ZRO: <url>"
- **`recolherEntregas`:** `removerPermissao` em cada registro ativo do projeto com motivo `entregas`; grava `revogadoEm`; zera `entregasLiberadasEm`; histórico "Entregas recolhidas.".
- **`entregasDoProjeto(driveProjetoId)`:** lê `entregasId` **do banco**; lista até 3 níveis e 500 itens; `secao` = primeira pasta (Master, Redes, Legendas); cache em memória de 60 s por id. Pastas não aparecem como itens; arquivos Google (Docs) só têm `verUrl`.
- **Acesso da equipe** (Ajustes): `criarPermissao` de `writer` na raiz para o e-mail Google do Victor ou do Edu, sem e-mail de aviso. Serve para o link de download abrir no navegador deles quando não estiverem logados com contato@dissesim.com.br.

---

## 5. Protocolo de envio (contrato único)

### `src/lib/drive/protocolo.ts` (puro: tipos, zod e mensagens; usado no navegador e no servidor)

```ts
export const ALINHAMENTO = 256 * 1024;
export const MAX_CORPO = 64 * 1024;           // JSON das rotas
export const MAX_POR_PEDIDO = 50;             // arquivos por iniciar/conferir/cancelar
export const MAX_POR_LOTE = 20_000;
export type FonteChave = "cam-a" | "cam-b" | "cam-c" | "drone" | "cam-e" | "foto" | "gravador";

export type Destino =
  | { tipo: "pasta"; pastaId: string }                                                       // painel
  | { tipo: "cartao"; fonte: FonteChave; pessoa: { freelancerId: string } | { nome: string };
      gravador?: string; cartaoNome?: string; decisao?: "continuar" | "novo"; continuarLoteId?: string }   // freela
  | { tipo: "cliente"; projetoId: string | null; assunto: string; consentimento: true };      // cliente

export type PedidoLote = { op: "lote"; destino: Destino; arquivos: number; bytes: number; impressao: string };
export type RespLote =
  | { ok: true; loteId: string; rotulo: string; caminho: string; retomado: boolean }
  | { ok: true; pergunta: { loteId: string; rotulo: string; arquivos: number; bytes: number } };

export type ArquivoPedido = { chave: string; nome: string; caminho: string; tamanho: number; tipo: string; modificado?: number };
export type PedidoIniciar = { op: "iniciar"; loteId: string; arquivos: ArquivoPedido[] };          // 1..50
export type ResultadoIniciar =
  | { chave: string; ok: true; envioId: string; estado: "enviar"; sessao: string; offset: number; retomado: boolean }
  | { chave: string; ok: true; envioId: string; estado: "concluido"; jaRecebido: boolean }
  | { chave: string; ok: false; erro: CodigoErro; mensagem: string };
export type RespIniciar = { ok: true; resultados: ResultadoIniciar[] };

export type PedidoConferir = { op: "conferir"; envioIds: string[] };                               // 1..50
export type ResultadoConferir = { envioId: string } & (
  | { estado: "concluido" } | { estado: "parcial"; offset: number }
  | { estado: "expirado" } | { estado: "falhou"; mensagem: string } | { estado: "cancelado" });
export type RespConferir = { ok: true; resultados: ResultadoConferir[] };

export type PedidoCancelar = { op: "cancelar"; envioIds: string[] };
export type RespCancelar = { ok: true; cancelados: number; concluidos: number };
export type PedidoFecharLote = { op: "fecharLote"; loteId: string };
export type RespFecharLote = { ok: true; estado: "concluido" | "parcial" | "cancelado"; arquivos: number; bytes: number; faltam: number };

// Só painel, só o teste de Ajustes
export type PedidoDiagnostico = { op: "diagnostico"; envioId: string; resultado: ResultadoDiagnostico };   // depois do envio de teste
export type RespDiagnostico = { ok: true; registro: DiagnosticoRegistro };
export type ResultadoDiagnostico = { preflight: boolean; viu308: boolean; rangeLegivel: boolean; finalLegivel: boolean; host: string; navegador: string };
export type DiagnosticoRegistro = ResultadoDiagnostico & { em: string; ok: boolean; conferido: boolean };

export type CodigoErro =
  | "sem_acesso" | "formato" | "sem_google" | "reconectar" | "pasta" | "sem_espaco" | "limite_diario" | "limite_link"
  | "link_inativo" | "senha" | "muitas_tentativas" | "nao_encontrado" | "conferencia" | "consentimento" | "google";
export type RespErro = { ok: false; erro: CodigoErro; mensagem: string; cabem?: number };

export const MENSAGENS: { painel: Record<CodigoErro, string>; publico: Record<CodigoErro, string> };
export const esquemas: { lote; iniciar; conferir; cancelar; fecharLote; diagnostico };   // zod
```

**Status HTTP** (toda resposta com `Cache-Control: no-store` e `Content-Type: application/json`):

| Status | Erro |
|---|---|
| 400 | `formato`, `consentimento` |
| 401 | `sem_acesso` (painel sem sessão) |
| 403 | `sem_acesso` (Origin), `senha` (área com senha, sem cookie válido) |
| 404 | `nao_encontrado` (token, lote ou envio fora do escopo) |
| 409 | `link_inativo` |
| 413 | `limite_link` (com `cabem`), corpo grande demais |
| 415 | `formato` (Content-Type) |
| 429 | `muitas_tentativas`, `limite_diario` |
| 503 | `sem_google`, `reconectar`, `google` |
| 507 | `sem_espaco` |

**Mensagens** (o servidor escolhe a voz pelo escopo):

| Código | Painel | Público |
|---|---|---|
| `sem_google` | "Google Drive desconectado. Conecte em Ajustes." | "Não dá para receber arquivos agora. Avise a ZRO." |
| `reconectar` | "A conexão com o Google expirou. Reconecte em Ajustes." | igual à anterior |
| `sem_espaco` | "O Drive está cheio. Libere espaço e tente de novo." | igual à anterior |
| `limite_diario` | "O Google limita 750 GB de envio por dia. Libera em até 24 horas." | "Muito material hoje. Tente de novo amanhã ou avise a ZRO." |
| `pasta` | "A pasta não existe mais no Drive." | "Não dá para receber arquivos agora. Avise a ZRO." |
| `link_inativo` | n/a | "Este link não está mais ativo. Peça um novo para a ZRO." |
| `limite_link` | n/a | "Este link aceita até 50 GB. Ainda cabem 12 GB." (montado com os números) |
| `conferencia` | "O Drive recebeu um arquivo diferente do declarado." | "Não deu para conferir este arquivo. Toque em Tentar de novo." |
| `google` | "O Google recusou (<motivo>). Tente de novo." | "Não deu para enviar agora. Tente de novo em instantes." |

### Escopos e quem pode o quê

```ts
type Escopo =
  | { origem: "painel"; userId: string }
  | { origem: "freela"; link: LinkAtivo }                    // tipo freela-diaria
  | { origem: "cliente"; link: LinkAtivo; clientId: string };   // tipo cliente-area, cookie ok (se tiver senha)
```

| Op | Painel | Freela | Cliente |
|---|---|---|---|
| `lote` | destino `pasta` | destino `cartao`; link ativo | destino `cliente`; link ativo; cookie se tiver senha |
| `iniciar` | lotes `origem='painel'` | lotes do link; link não revogado (expirado depois do início do lote: aceito) | idem, com cookie se tiver senha |
| `conferir`, `cancelar`, `fecharLote` | lotes do painel | lotes do link, **mesmo com o link expirado ou revogado** | idem, **sem exigir o cookie** (o envioId é UUID do próprio link) |
| `diagnostico` | sim | não | não |

Lote e envio são sempre buscados **com o filtro do escopo** (`origem` + `linkId`). Fora do escopo: 404.

### `src/lib/services/drive-envios.ts` (`server-only`)

```ts
export async function abrirLote(p: PedidoLote, escopo: Escopo, origemNavegador: string): Promise<RespLote | RespErro>;
export async function iniciarArquivos(p: PedidoIniciar, escopo: Escopo, origemNavegador: string): Promise<RespIniciar | RespErro>;
export async function conferirEnvios(p: PedidoConferir, escopo: Escopo): Promise<RespConferir | RespErro>;
export async function cancelarEnvios(p: PedidoCancelar, escopo: Escopo): Promise<RespCancelar | RespErro>;
export async function fecharLote(p: PedidoFecharLote, escopo: Escopo): Promise<RespFecharLote | RespErro>;
export async function conciliarParados(limite?: number): Promise<number>;     // chamada com after() pelo painel
export async function marcarLotesVistos(ids: string[]): Promise<void>;
```

**`abrirLote`**
1. Validação (zod). `arquivos` ≤ `MAX_POR_LOTE`. `impressao` = 64 hex.
2. Google conectado, sem `erro`.
3. **Destino:**
   - **painel `pasta`:** `idDriveValido`, `arquivo()` é pasta, fora da lixeira, `canAddChildren`. Rótulo = nome da pasta; caminho = `caminhoDaPasta`.
   - **freela `cartao`:**
     - pessoa: `freelancerId` precisa estar em `event_crew` da diária do link (senão 400); `nome` livre tem 2 a 60 caracteres e passa por `nomePasta`. `pessoaNome` = nome do cadastro.
     - `diariaDoEvento(link.eventId)` (o evento precisa existir e ter projeto; senão `link_inativo`).
     - **vídeo:** `cenas da diária → nomePastaCamera(fonte, pessoa)`.
       - `decisao:"continuar"` com `continuarLoteId` do mesmo link, fonte e pessoa: reabre aquele lote.
       - mesma `impressao` + link + fonte + pessoa, lote não concluído: devolve ele (`retomado:true`). **Sem número novo.**
       - sem `decisao`, e existe lote do mesmo link, fonte, pessoa e `cartaoNome` nas últimas 24 h: devolve `pergunta` (é o mesmo cartão com arquivos novos?).
       - senão: **rolo atômico** e `garantirPasta(camera, rotuloRolo(letra, n), { descricao: "Cartão EOS_DIGITAL · enviado por Rafael Moura" })`.
     - **áudio:** `gravador` obrigatório (2 a 40 caracteres) → `audios da diária → nomePastaGravador(gravador, pessoa)`. Sem rolo.
   - **cliente:** `consentimento === true` (senão 400). `assunto` de 2 a 80 caracteres.
     - `projetoId` null: `garantirArquivosDaEmpresa(clientId)`.
     - senão: o projeto precisa ser **do cliente do link** e não cancelado (senão 404). `garantirPastasDoProjeto` → `subpastas["03 Assets/Do cliente"]`.
     - Pasta do lote: `nomePastaAssunto(hoje, assunto)` (mesma data e assunto reaproveitam a pasta).
     - Limite diário: `bytes de hoje (concluídos + abertos com sinal nas últimas 2 h) + bytes ≤ limiteBytes`; senão 413 `limite_link` com `cabem`.
4. Freela com `limiteBytes`: mesma conta, no total do link.
5. Insere o lote e devolve `{ loteId, rotulo, caminho, retomado }`.

**Rolo atômico** (uma instrução, linha travada pelo Postgres; `letra` validada em `/^[A-Z]$/`):
```sql
update drive_projetos
   set rolos = jsonb_set(rolos, array[$letra::text], to_jsonb(coalesce((rolos->>$letra::text)::int, 0) + 1)), atualizado_em = now()
 where id = $driveProjetoId
returning (rolos->>$letra::text)::int as n
```
(No Drizzle: `db.execute(sql\`…${letra}::text…\`)`; o cast evita o "could not determine data type of parameter" do Postgres e do PGlite.)
O número não volta: um lote cancelado deixa o buraco (a pasta vazia fica, nada é apagado).

**`iniciarArquivos`** (até 50, em paralelo de 6 no servidor; cada resultado independente):
1. Lote no escopo, estado `aberto` ou `parcial`. Link revogado: `link_inativo` (só para `iniciar`).
2. Validação: `nome` com `nomeDeArquivo`; `caminho` com `segmentosDoCaminho`; `tamanho` inteiro de 0 a 5 TiB; `tipo` com `tipoSeguro`.
3. Pasta final: `garantirCaminho(lote.pastaId, segmentos)`.
4. **Já recebido:** existe `drive_envios` `concluido` com a mesma `pastaId`, `nome` e `tamanho` → `{ estado:"concluido", jaRecebido:true }`.
5. **Retomada:** linha do lote com o mesmo `caminhoRelativo`, `nome`, `tamanho` (e `modificado`, quando os dois lados têm) e estado `enviando`/`expirado`/`falhou`:
   - `enviando` com sessão: `consultarSessao` no servidor. 308 → devolve a mesma sessão com `offset` e `retomado:true`. 200 → conclui (como em `conferir`). 404 → passo 6 reaproveitando a linha.
   - **Nunca devolve uma sessão sem antes consultar** (uma URI morta não volta para o navegador).
6. **0 byte:** `criarVazio` → concluído na hora.
7. Sessão nova: `abrirSessao({ … origem: origemNavegador, envioId })`, grava `sessaoEnc = selar(sessao, "drive_envios.sessao:"+id)`, `sessaoExpiraEm = agora + 6 dias`, `sessaoHost`. Pai 404: `esquecerPasta` e uma nova tentativa.
8. Atualiza `ultimoSinalEm` do envio e do lote, `ultimoUsoEm` do link.

**`conferirEnvios`** (sempre atualiza a linha; é a única op de estado):
1. Linha no escopo. `concluido`/`cancelado`/`expirado`: devolve o estado (idempotente).
2. `consultarSessao`:
   - **concluido:** `arquivo(id)` precisa ter `parents ∋ pastaId`, `size == tamanho`, `trashed=false`. Bateu:
     ```sql
     update drive_envios set estado='concluido', arquivo_id=$id, md5=$md5, concluido_em=now(), sessao_enc=null
      where id=$envio and estado='enviando' returning id
     ```
     Só quem recebeu a linha soma no lote (`arquivos_recebidos + 1`, `bytes_recebidos + tamanho`). Não bateu: `estado='falhou'`, `erro=conferencia`. **Nada é apagado no Drive.**
   - **parcial:** `{ estado:"parcial", offset }`.
   - **morta:** `acharPorEnvio(id, pastaId)` antes de desistir. Achou com o tamanho certo: conclui. Não achou: `estado='expirado'`, `sessaoEnc=null`.
3. **O id do arquivo vem sempre da sessão ou da busca no Drive, nunca do navegador.**

**`cancelarEnvios`:** consulta primeiro. Se já terminou (200), **conclui em vez de cancelar**. Senão `cancelarSessao`, `estado='cancelado'`, `sessaoEnc=null`.

**`fecharLote`:** recalcula as contagens. Estado: todos previstos recebidos → `concluido`; senão `parcial` (ou `cancelado` se nada chegou e o navegador cancelou). Histórico do CRM **uma vez**: `update drive_lotes set avisado_em=now() where id=$1 and avisado_em is null returning id` → só então grava (texto na seção 7.5). Painel não gera histórico.

**`conciliarParados(limite = 20)`** (sem cron; roda com `after()` quando o painel abre Arquivos ou a aba Drive): linhas `enviando` com `ultimoSinalEm` de mais de 2 h. Para cada uma, o mesmo caminho do `conferir` (consulta, busca por `appProperties`, conclui ou marca `expirado`). Lote sem nada pendente é fechado (e gera o histórico, se for o caso). **Nenhuma linha vira `expirado` sem consultar o Google antes.**

### Limites (em `src/lib/drive/limites.ts`, memória por instância, e no banco)

- Por IP (memória): 6.000 requisições a cada 10 minutos; 20 tentativas de senha por hora.
- Por link (banco): 10.000 arquivos em `iniciar` por hora (`drive_envios` × `drive_lotes.link_id`).
- Senha da área: 5 erros em 15 minutos por link, em `login_attempts` com `email = "area:<linkId>"` e **`ip: null`**.
- Corpo JSON: 64 KB (413). Sem teto de tamanho por arquivo além dos 5 TB do Drive; o teto é o limite do link.
- **Sem pré-checagem de 750 GB nem de espaço pelo tamanho declarado** (quem tem o link poderia travar a empresa declarando 250 GB sem mandar nada). O próprio Google recusa na abertura da sessão (`storageQuotaExceeded`, `userRateLimitExceeded`) e a mensagem chega certa.
- Bytes que contam para o limite do link: `concluido` + `enviando` com sinal nas últimas 2 horas.

### Rotas (`src/lib/drive/rota.ts`, `server-only`)

```ts
export function rotaEnvioPainel(): (request: NextRequest) => Promise<Response>;
export function rotaEnvioPublica(tipo: "freela-diaria" | "cliente-area"): (request: NextRequest, ctx: { params: Promise<{ token: string }> }) => Promise<Response>;
```

Ordem das checagens, nas duas:
1. Pública: `ehPrevia()` → 404.
2. `Origin` presente, igual ao host (`x-forwarded-host`/`host`) e em `origensPermitidas()`; senão 403. (Painel: a mesma regra; o cookie já é `SameSite=Lax`.)
3. `Content-Type: application/json` (415); `content-length` e texto ≤ 64 KB (413).
4. Limite por IP (429).
5. Painel: `getSessionUser()` (401). Pública: token no formato `/^[A-Za-z0-9_-]{43}$/`, busca por `hashToken`, tipo certo (404); cliente com senha: cookie (403 `senha`) só para `lote` e `iniciar`.
6. `esquemas[op].safeParse` (400) e chamada do serviço com o escopo.
7. Cliente: renova o cookie da área a cada chamada válida (validade deslizante de 30 dias).

Os arquivos de rota ficam com 3 linhas: `export const dynamic = "force-dynamic"; export const POST = rotaEnvioPublica("freela-diaria");`.

### Protocolo para o app SOBEDESCE (etapa futura, nada implementado agora)

- O app abre o link do freela (`https://zrofilmes.vercel.app/enviar/<token>`, ou o atalho `sobedesce://enviar?u=<url>`).
- Fala com `POST /enviar/<token>/api` usando as mesmas ops, com o cabeçalho `X-ZRO-App: sobedesce/1` e **sem `Origin`**.
- Mudança necessária no servidor quando chegar a hora: aceitar a falta de `Origin` só com esse cabeçalho, abrir a sessão sem `Origin` (CORS não existe no app) e manter os mesmos limites por link.
- O app faz os `PUT` com o motor dele (vários arquivos em paralelo, pedaços maiores) e termina com `conferir` e `fecharLote`, como o navegador.

### Relay (só interface)

`Transporte` tem `pedaco?(envioId, inicio, corpo)`, nunca implementado. Se um dia existir: rota `PUT` com até 4 MiB, o servidor só aceita `inicio` igual ao offset confirmado, e o limite de 64 KB vale só para o JSON. Ver seção 9.

---

## 6. Motor no navegador (`src/lib/drive/navegador/`, sem `server-only`)

Porte em TypeScript da lógica de `uploader.js` do SOBEDESCE (decisões de `Range`, recuo, vigia de travamento, mensagens), com as correções deste plano. Comentário de origem no topo de `motor.ts`.

### Arquivos e API (contrato para PAINEL e PÚBLICO)

| Arquivo | Conteúdo |
|---|---|
| `motor.ts` | `criarMotor(opcoes): Motor` e os tipos `Foto`, `LoteFila`, `ItemFila`. |
| `rede.ts` | `Rede` (`put(url, { inicio, fim, total, corpo, aoProgresso, sinal })` → `{ status, range, texto }`; `status 0` = rede/CORS). `redeXHR` (navegador, com progresso) e `redeFetch` (testes em Node). |
| `transporte.ts` | `transporteDaRota(url): Transporte` com `lote`, `iniciar`, `conferir`, `cancelar`, `fecharLote`, `diagnostico`. `fetch` JSON, `credentials: "same-origin"`. Resposta não JSON ou redirecionada = "Entre de novo para continuar." (`precisaEntrar`). |
| `selecao.ts` | `deInput(files, { tirarRaiz })`, `deSoltura(dataTransfer, { tirarRaiz })`, `impressao(selecao)`, `podeEscolherPasta()`. |
| `retomar.ts` | Registro em `localStorage` (`zro.drive.v1.<escopo>`): só `{ loteId, rotulo, impressao, arquivos, bytes, enviados, criadoEm }` dos lotes abertos, por 30 dias. **Nunca URI de sessão, nunca `File`.** Toda leitura e escrita em `try/catch`. |
| `plataforma.ts` | `ehWebKit`, `ehIOS`, `ehAppDaTela` (standalone), `pedacoPadrao()`, `paralelosPadrao()`. |
| `tela-acesa.ts` | Porte de `wakelock.js` (`navigator.wakeLock.request("screen")`, pede de novo em `visibilitychange`). |
| `use-motor.ts` | `useMotor(opcoes): { motor, foto }` com `useSyncExternalStore` (redesenha no máximo 5 vezes por segundo). |
| `src/lib/drive/bytes.ts` (puro) | `bytesBR(n)` ("212,4 GB", base 1000 como o Finder e os cartões), `velocidadeBR(bps)` ("42 MB/s"), `tempoBR(seg)` ("52 min", "2 h 10 min"). |

```ts
export type EstadoItem = "fila" | "preparando" | "enviando" | "pausado" | "conferindo" | "concluido" | "ja-recebido" | "erro" | "cancelado";
export type ItemFila = { chave: string; lote: string; envioId: string | null; nome: string; caminho: string; tamanho: number; enviado: number;
  estado: EstadoItem; nota: string | null; erro: string | null };
export type LoteFila = { chave: string; loteId: string | null; rotulo: string | null; caminho: string | null;
  estado: "preparando" | "pergunta" | "enviando" | "pausado" | "concluido" | "parcial" | "erro" | "cancelado";
  arquivos: number; bytes: number; recebidos: number; bytesEnviados: number; ignorados: string[];
  pergunta: { loteId: string; rotulo: string } | null; erro: string | null };
export type Foto = { lotes: LoteFila[]; itens: ItemFila[];
  total: { bytes: number; enviados: number; velocidade: number; restante: number | null };
  ativo: boolean; semInternet: boolean; precisaEntrar: boolean; retomaveis: LoteSalvo[]; diagnostico: ResultadoDiagnostico | null };
export interface Motor {
  adicionar(selecao: Selecao, destino: Destino): string;          // devolve a chave do lote
  responder(lote: string, decisao: "continuar" | "novo"): void;
  pausar(chave?: string): void; continuar(chave?: string): void;
  cancelar(chave: string): void; tentarDeNovo(chave?: string): void;
  limparConcluidos(): void; assinar(fn: () => void): () => void; foto(): Foto; destruir(): void;
}
export function criarMotor(o: { transporte: Transporte; escopo: string; voz: "painel" | "publico";
  rede?: Rede; paralelos?: number; pedacoMiB?: number; diagnostico?: boolean }): Motor;

// selecao.ts
export type Selecao = { arquivos: { file: File; caminho: string /* pastas, sem o nome */ }[]; ignorados: string[]; cartaoNome: string | null };
// retomar.ts
export type LoteSalvo = { loteId: string; rotulo: string; impressao: string; arquivos: number; bytes: number; enviados: number; criadoEm: number };
// transporte.ts: uma função por op; erro de HTTP vira RespErro; resposta não JSON vira { ok: false, erro: "sem_acesso" } + precisaEntrar
export interface Transporte {
  lote(p: PedidoLote): Promise<RespLote | RespErro>;  iniciar(p: PedidoIniciar): Promise<RespIniciar | RespErro>;
  conferir(p: PedidoConferir): Promise<RespConferir | RespErro>;  cancelar(p: PedidoCancelar): Promise<RespCancelar | RespErro>;
  fecharLote(p: PedidoFecharLote): Promise<RespFecharLote | RespErro>;  diagnostico?(p: PedidoDiagnostico): Promise<RespDiagnostico | RespErro>;
  // pedaco(envioId, inicio, corpo): relay, reservado e não implementado (seção 5)
}
```

### Seleção com pastas

- **Escolher pasta** (computador): `<input type="file" webkitdirectory multiple>`; o caminho vem de `file.webkitRelativePath`. `podeEscolherPasta()` é falso no iOS (o Safari do iPhone não escolhe pastas).
- **Arrastar:** no `drop`, chamar `item.webkitGetAsEntry()` para **todos os itens antes de qualquer `await`** (o `DataTransfer` some depois). Diretórios: `createReader().readEntries()` em laço até vir vazio (o Chrome entrega de 100 em 100). Arquivo: `entry.file()`. O caminho sai de `entry.fullPath`.
- `tirarRaiz` (só o freela, `cartao`): se a seleção tem **uma** pasta de topo, o nome dela vira `cartaoNome` e sai do caminho. Arquivos soltos vão para a raiz do rolo.
- Arquivos de sistema (`ehLixoDoSistema`) ficam fora e aparecem em `ignorados` ("3 arquivos do sistema ignorados").
- `impressao(selecao)`: SHA-256 (WebCrypto) das linhas `caminho/nome|tamanho` ordenadas, sem `lastModified`.

### Algoritmo por arquivo

1. **Abrir o lote** (uma vez): `lote`. Se vier `pergunta`, o lote fica em `pergunta` até `responder()`.
2. **Iniciar sob demanda:** quando o item vai começar. Arquivos pequenos (até um pedaço) seguidos são iniciados em grupos de até 20 numa chamada.
   - `concluido` (já recebido ou 0 byte): item `ja-recebido`/`concluido`, sem `PUT`.
   - `enviar`: começa do `offset` que o servidor devolveu.
3. **Laço** enquanto `offset < T`:
   - `fim = min(offset + pedaco, T)`. Todo pedaço, menos o último, é múltiplo de 256 KiB.
   - `PUT` com `Content-Range: bytes offset-(fim-1)/T`, **sem `Authorization`**, sem `Content-Length` (proibido no navegador). Corpo: `file.slice(offset, fim, tipo)`.
   - Progresso: `enviado = offset confirmado + bytes em voo` (`xhr.upload.onprogress`).

| Resposta | Ação |
|---|---|
| 308 com `Range` legível | `offset = N + 1` (`Range: bytes=0-N`). Marca no aparelho que o `Range` é legível (`zro.drive.rangeVisivel`). Nunca supõe que o pedaço inteiro chegou. |
| 308 sem `Range`, aparelho **já viu** `Range`, offset confirmado era 0 | A ausência é real: o Google tem 0 byte. |
| 308 sem `Range` nos outros casos (aparelho **nunca viu** `Range`, ou offset confirmado maior que 0) | **Desconhecido, não zero.** Pergunta ao servidor (`conferir`), que lê o `Range` sem CORS. |
| Qualquer 308 em que o offset **não avançou** depois de um `PUT` completo de dados | É o bug 319985 do WebKit (corpo vazio). Este arquivo passa para cópia em memória por pedaço (`new Blob([await pedaco.arrayBuffer()])`) e repete. Duas vezes sem avanço na cópia: erro "Este navegador não conseguiu ler o arquivo. Tente pelo Chrome no computador." |
| 200/201 | Sai do laço (o corpo nem precisa ser legível). |
| status 0 **no último pedaço** | `conferir` (a resposta final pode vir sem CORS; o servidor resolve). |
| status 0 nos outros | Recuo com jitter (até 64 s, no máximo 10 falhas seguidas) e depois `consultar()`. |
| 404/410 | `conferir` primeiro. O servidor confirma `expirado` (ou acha o arquivo e conclui). Só então `iniciar` de novo, no máximo 3 recomeços: "O envio expirou no Google; recomeçando este arquivo." |
| 5xx, 429, 403 de taxa | Recuo, depois `consultar()`. |
| 403 `storageQuotaExceeded` ou `userRateLimitExceeded` repetido 4 vezes | Erro final com a mensagem; limite diário pausa a fila inteira e mostra um aviso só. |
| 400/416 | `consultar()` (até 3 vezes); se persistir, recomeça o arquivo. |

4. **Sempre termina com `conferir`** (estado `conferindo`). `concluido` → item concluído. `parcial` → volta ao laço no `offset`. `expirado` → recomeça. Os `conferir` são agrupados (janela de 300 ms, até 50).
5. **`consultar()`:** `PUT` vazio com `bytes */T` pelo navegador. 308 com `Range` → offset. 308 sem `Range` → mesma regra da tabela (0 só se o aparelho já viu `Range` e o offset confirmado era 0; senão, servidor). 200 → `conferir`. 404 ou status 0 → `conferir` (o servidor consulta).
6. Lote sem itens ativos → `fecharLote` → estado final do lote (`concluido` ou `parcial`, com "126 de 128 arquivos chegaram").

### Regras gerais

- **Pedaço:** 32 MiB no computador; 8 MiB no WebKit (iPhone e Safari do Mac). `pedacoMiB` só para testes e diagnóstico.
- **Paralelo:** 2 arquivos no computador, 1 no iOS. Partes de um mesmo arquivo nunca em paralelo.
- **Vigia de travamento:** 45 s sem progresso derruba o XHR e chama `consultar()`.
- **Sem internet:** em `offline`, pausa sozinho ("Sem internet. Continua sozinho quando a conexão voltar."). Em `online` e em `visibilitychange → visible`, consulta e continua. No iOS, quem ficou 1 s fora de vista sem dar sinal é refeito (como o `uploader.js`).
- **Tela acesa:** Wake Lock enquanto houver item enviando; pede de novo ao voltar.
- **Sair da página:** `pagehide` grava o registro de retomada (lotes abertos). `beforeunload` avisa no computador enquanto houver envio. No iOS só vale a retomada: a tela pede "Deixe esta tela aberta até terminar."
- **Retomada depois de recarregar:** a faixa mostra os lotes salvos ("O rolo A003 parou em 38%. Escolha o mesmo cartão para continuar."). Escolhido de novo, o `lote` com a mesma `impressao` devolve o mesmo `loteId` e o `iniciar` de cada arquivo devolve `ja-recebido` ou a sessão com o `offset`. No WebKit, o arquivo casa por caminho, nome e tamanho (o `lastModified` da Fotos muda a cada escolha); fora dele, `modificado` desempata.
- **Precisa entrar:** 401 (painel) ou 403 `senha` (área) pausam tudo com `precisaEntrar`. A tela mostra o login ou o campo de senha **sem perder a fila**, e `continuar()` segue.
- **Diagnóstico** (`diagnostico: true`): registra `preflight` (o primeiro `PUT` não deu status 0), `viu308`, `rangeLegivel`, `finalLegivel` e o host da sessão. Nunca mostra a sessão.

---

## 7. Telas do painel

Seguem `docs/dev/area-interna.md`: `requireUser()` primeiro, `PageHeader` sem `description`, formulários em uma coluna a 390 px, alvos ≥ 40 px, preto e branco, cor só para status e sempre com texto, textos operacionais.

### 7.1 Arquivos (`/painel/arquivos`)

- **Menu:** depois de "Projetos", `{ href: "/painel/arquivos", label: "Arquivos", icon: HardDrive }`.
- **Endereço:** `?pasta=<id>` (validado; sem ele, a raiz ZRO), `?pagina=<token>`, `?drives=1` (drives compartilhados). Lista no servidor (`listarPasta`), com `router.refresh()` quando um lote termina.
- **Topo:** `<PageHeader label="Drive" title="Arquivos" />`.
- **Card "Chegou"** (lotes de freela e cliente dos últimos 7 dias, até 8):
  - ícone pela origem (`Camera` vídeo, `Mic` áudio, `Building2` cliente);
  - linha 1: "A003 · Câm A · Rafael Moura" ou "Manual de marca · SERHS";
  - linha 2: "Verão Pipa · Diária 02 · 128 arquivos · 212,4 GB · há 2 h";
  - Badge: Recebido (`ok`), Enviando (`neutral`), Interrompido (`warn`, sem sinal há mais de 2 h), Parcial (`warn`, "faltam 2"), Cancelado (`neutral`);
  - ponto de "novo" quando `vistoEm` é nulo; `after(() => marcarLotesVistos(ids))` e `after(() => conciliarParados())`;
  - "Abrir no Drive".
- **Navegador** (grade `xl:grid-cols-12`: lista em 8, fila em 4; no celular, a fila vira uma faixa fixa embaixo):
  - Trilha: Meu Drive / ZRO / Clientes / SERHS. "Drives compartilhados" ao lado de Meu Drive.
  - Barra: **Enviar arquivos** (primário), **Enviar pasta** (só onde `podeEscolherPasta()`), **Nova pasta** (FormModal, uma linha), **Abrir no Drive**, Select "Ir para o projeto" (projetos com pasta pronta).
  - Itens: pastas primeiro (abrem com clique), depois arquivos com nome, tamanho, data e as ações **Baixar** (`webContentLink`, `target=_blank rel=noreferrer`) e **Abrir** (`webViewLink`). No celular, as ações vão num `Menu`.
  - "Mostrar mais" quando há `proxima`.
  - Arrastar sobre a lista mostra "Solte para enviar para <pasta>".
- **Fila** (`fila.tsx`, `useMotor` com `voz: "painel"`, transporte `/painel/arquivos/api`, destino `{ tipo: "pasta", pastaId }`):
  - total no topo ("1,2 GB de 4,8 GB · 38 MB/s · faltam 2 min"), barra `h-1 rounded-full bg-white/[0.08]` com preenchimento `bg-white/80`;
  - por lote: rótulo, contagem, Pausar/Continuar/Cancelar/Tentar de novo; itens recolhidos (abre para ver os arquivos);
  - toast "Arquivos no Drive." ao fechar um lote.

| Estado | Texto |
|---|---|
| Sem config | Card de aviso: "Faltam as chaves do Google na Vercel." + ButtonLink "Ver em Ajustes" |
| Desconectado | "Google Drive desconectado." + ButtonLink "Conectar em Ajustes" |
| Reconectar | "A conexão com o Google expirou." + ButtonLink "Reconectar" |
| Pasta vazia | EmptyState "Pasta vazia." + "Enviar arquivos" |
| Pasta não encontrada | "Esta pasta não existe mais no Drive." + "Voltar para ZRO" |
| Na fila / Enviando | "Na fila" / "Enviando · 1,2 GB de 4,8 GB · 38 MB/s · 2 min" |
| Pausado | "Pausado" / "Sem internet. Continua sozinho quando a conexão voltar." |
| Conferindo | "Conferindo no Drive…" |
| Já estava | "Já estava na pasta" |
| Concluído | "No Drive" + "Abrir" |
| Erro de rede | "A conexão caiu várias vezes. Toque em Tentar de novo: continua de onde parou." |
| Precisa entrar | "Sua sessão expirou. Entre de novo para continuar." + ButtonLink "Entrar" |
| Retomável | "1 envio parou no meio. Escolha os mesmos arquivos para continuar." |
| iPhone | "Escolha pelo app Arquivos para mandar o vídeo original." e "Deixe esta tela aberta até terminar." |

### 7.2 Projeto → aba Drive (`/painel/projetos/<id>?aba=drive`)

- `TABS` ganha `{ key: "drive", label: "Drive" }` depois de "Documentos". `counts.drive` = lotes do projeto.
- Grade `xl:grid-cols-3`:
  - **Card "Pasta do projeto"** (coluna 1):
    - sem Google: "Conecte o Google Drive em Ajustes.";
    - sem pasta: "Este projeto ainda não tem pasta no Drive." + **Criar pastas no Drive**;
    - criando: "Criando as pastas…" (`router.refresh()` a cada 3 s, até 30 s);
    - pronta: caminho em mono pequeno, **Abrir no Drive**, **Enviar arquivos** (→ `/painel/arquivos?pasta=<id>`), lista das 7 pastas com link (nomes exatos da estrutura);
    - `deLink`: nota "Usando a pasta do link do projeto.";
    - incompleta/erro: a mensagem + **Tentar de novo** (e "Recriar o que falta", que confere cada id);
    - `contaAntiga`: "As pastas estão na conta antiga (<e-mail>)." + **Criar na conta atual**.
  - **Card "Material das diárias"** (colunas 2 e 3): uma linha por diária do projeto.
    - "12/03 · Diária 02" (sem número ainda: só a data), local.
    - Badge do link: Ativo (`ok`), "Expira em 3 dias" (`warn`), Expirado (`warn`), Desativado (`neutral`), Sem link.
    - Ações: **Gerar link** | **Copiar link** e **WhatsApp**; `Menu` com "Mudar validade", "Trocar link" (ConfirmAction "O link antigo para de funcionar.") e "Desativar" (ConfirmAction "Desativar este link?" + Checkbox "Cancelar os envios em andamento").
    - Embaixo, os rolos: "A003 · Câm A · Rafael Moura · 128 arquivos · 212,4 GB · 12/03 18:40" + Badge + "Abrir". Vazio: "Nada recebido ainda."
  - **Card "Entregas para o cliente":**
    - sem cliente: "Projeto sem cliente.";
    - não liberado: "O cliente ainda não vê as entregas." + **Liberar entregas** (ConfirmAction: "Quem tiver o link da área do cliente baixa os arquivos de 06 Entregas. Tudo o que entrar nessa pasta aparece para ele. <e-mail> recebe um e-mail do Google com o acesso.");
    - liberado: "Liberadas em 14/03 por Victor" + "contato@serhs.com.br avisado pelo Google" + **Copiar link da área** + **Recolher** (ConfirmAction "Recolher as entregas?" "O link de download e o acesso por e-mail param de funcionar. Os arquivos continuam no Drive.");
    - erro do Workspace: "O Google Workspace bloqueou o link público. Veja Ajustes → Google Drive."
  - **Card "Do cliente":** lotes de origem `cliente` do projeto: "Manual de marca · 4 arquivos · 12 MB · 13/03" + "Abrir".
- Ações em `projetos/drive-actions.ts`: `criarPastasAction`, `envioDaDiaria(eventId, criar)` (devolve `{ ok, link, diaria, rolos }`, chamada direta com `startTransition`), `validadeLinkAction`, `trocarLinkAction`, `desativarLinkAction`, `liberarEntregasAction`, `recolherEntregasAction`. Todas: `requireUser()`, zod, serviço da BASE, `revalidatePath` do projeto, da agenda e do cliente.

**Texto do WhatsApp do link da diária** (3 variações):
1. **"Link para o material da diária de 12/03 (Verão Pipa): <url>. No computador, escolha o cartão inteiro. Um envio por cartão."** (escolhida: diz o que fazer e o jeito certo, sem rodeio)
2. "Material da diária de 12/03, Verão Pipa: <url>. Cada cartão em um envio, pelo computador."
3. "Para descarregar os cartões da diária de 12/03 (Verão Pipa): <url>"

### 7.3 Diária (janela da agenda)

- Em `EventDetails` (`agenda-dialogs.tsx`), para `type === "diaria"` com projeto, uma `InfoRow` nova com ícone `Upload` e rótulo "Material", que monta `<DiariaEnvio eventId=… />` (`agenda/diaria-envio.tsx`, "use client"):
  - ao montar, chama `envioDaDiaria(eventId, false)`;
  - sem Google: "Conecte o Drive em Ajustes.";
  - sem link: **Gerar link de envio** (`envioDaDiaria(eventId, true)`, copia e mostra o toast "Link copiado.");
  - com link: **Copiar link**, **WhatsApp** e "3 rolos recebidos" (link para a aba Drive do projeto);
  - expirado ou desativado: Badge + **Gerar link novo**.
- `deleteEvent` chama `revogarLinksDe({ eventId })` antes da transação que apaga o evento.

### 7.4 CRM → cliente → aba "Área do cliente"

- `TABS` da ficha do cliente ganha `{ key: "area", label: "Área do cliente" }` depois de "Financeiro".
- **Card "Link da área":**
  - sem área: "Este cliente ainda não tem área." + **Criar área do cliente** (FormModal: "Senha (opcional)" com no mínimo 6 caracteres, "Limite de envio por dia (GB)" com 20 por padrão);
  - com área: link em mono truncado, **Copiar link**, **WhatsApp**, Badge "Com senha"/"Sem senha"; `Menu` com "Definir senha"/"Trocar senha"/"Tirar senha", "Mudar limite", "Trocar link" (ConfirmAction "O link antigo para de funcionar.") e "Desativar área" (ConfirmAction + Checkbox "Cancelar os envios em andamento").
- **Card "Entregas":** cada projeto do cliente com o estado (Liberadas em 14/03 · Não liberadas · Sem pasta) e **Liberar**/**Recolher** (as mesmas actions da 7.2).
- **Card "Enviado pelo cliente":** lotes de origem `cliente`: "13/03 · Manual de marca · Verão Pipa · 4 arquivos · 12 MB" + "Abrir". Vazio: "Nada enviado ainda."
- **Card "Pasta do cliente":** "Abrir no Drive" (Clientes/<Cliente>) e "Arquivos da empresa".
- Ações em `crm/area-actions.ts`: `criarAreaAction`, `senhaAreaAction`, `limiteAreaAction`, `trocarLinkAreaAction`, `desativarAreaAction`. `deleteClient` revoga a área antes de apagar.

**Texto do WhatsApp da área** (3 variações):
1. **"Olá, <Contato>. Esta é a área da <Cliente> na ZRO: <url>. Lá ficam os arquivos finais dos projetos, e por ela você nos manda logo, manual de marca e referências."** (escolhida)
2. "Olá, <Contato>. A área da <Cliente> na ZRO: <url>. Entregas para baixar e um lugar para nos mandar arquivos."
3. "<Contato>, os arquivos dos projetos da <Cliente> ficam aqui: <url>"

Com senha, uma segunda mensagem: "A senha vai em outra mensagem." Nenhuma variação usa exclamação.

### 7.5 Histórico, ícone, backup e exemplos

- `src/lib/services/activity.ts` (BASE): a união aceita `"arquivos"`, e entra `logClientActivity(clientId, type, content, authorId?)` para envio de cliente sem projeto.
- `crm/crm-ui.tsx` (PAINEL): `ACTIVITY_ICONS.arquivos = HardDrive` e `"arquivos"` em `SYSTEM_TYPES`. `crm/crm-options.ts`: `AUTO_ACTIVITY.arquivos = "Arquivos"`.
- **Textos do histórico** (gravados por `fecharLote`, uma vez por lote):
  - vídeo: "Rafael Moura enviou o rolo A003 · Câm A · Diária 02: 128 arquivos, 212,4 GB."
  - áudio: "Carla Dias enviou o áudio do Zoom F6 · Diária 02: 12 arquivos, 3,1 GB."
  - parcial: "… (faltaram 2 arquivos)."
  - cliente: "SERHS enviou “Manual de marca”: 4 arquivos, 12 MB."
  - entregas: "Entregas liberadas para o cliente." / "Entregas recolhidas."
- Backup e demo-data: seção 3.

---

## 8. Páginas públicas

### 8.1 Comum

- Sem layout do site (como `/orcamento` e `/entrar`): `min-h-dvh`, `zro-grain`, brilho radial, `container-zro max-w-3xl`, `Symbol` + `LightPoint` no topo, rodapé com a assinatura "Onde tudo começa e o comum termina."
- Botão principal: pílula `h-14 rounded-full bg-white text-void`. Secundário: contorno `border-line-strong`. Rótulos `label` em mono caixa alta. Movimento com `motion/react`, curva `[0.16, 1, 0.3, 1]`, respeitando `usePrefersReducedMotion()`.
- Campos com 16 px (sem zoom no iPhone). **Sem `maximumScale`** (acessibilidade). Progresso com `aria-live="polite"` atualizado no máximo a cada 5 s.
- `metadata`: `robots: { index: false, follow: false }`; sem `manifest` (não é o app do painel).
- `dynamic = "force-dynamic"`. Token fora do formato ou não achado: `notFound()`. Prévia: `notFound()`.
- Os dados vêm de `abrirLinkPublico(token, tipo)` (BASE, `src/lib/services/drive-publico.ts`):
  ```ts
  export type LinkPublico =
    | { estado: "expirado" | "desativado" | "indisponivel"; whatsapp: string | null }
    | { estado: "senha"; linkId: string }
    | { estado: "ok"; tipo: "freela-diaria"; linkId: string; diaria: DadosDiaria }
    | { estado: "ok"; tipo: "cliente-area"; linkId: string; area: DadosArea };
  export type DadosDiaria = { projeto: string; diaria: { nome: string /* "Diária 02" */; data: string; dataLonga: string };
    pessoas: { id: string; rotulo: string /* "Rafael M." */; funcao: string | null }[];
    gravadores: string[];   // já usados no projeto, para sugerir
    limite: { bytes: number; usados: number } | null; expiraEm: string | null };
  export type DadosArea = { cliente: string; googleOk: boolean;
    projetos: { id: string; titulo: string; mes: string /* "março de 2026" */; liberado: boolean; entregas: EntregaArquivo[] }[];
    envios: { data: string; assunto: string; projeto: string | null; arquivos: number; bytes: number }[];   // últimos 10
    limiteDiario: number | null; enviadoHoje: number };
  export async function abrirLinkPublico(token: string, tipo: "freela-diaria" | "cliente-area"): Promise<LinkPublico | null>;
  ```
  - A área só lista projetos **do cliente do link**, não cancelados, com `drive_projetos` na conta atual. `entregas` só vem preenchido com `liberado`.
  - Na diária, o nome do freela aparece como "Rafael M." (primeiro nome e inicial). O nome completo só vai para a pasta no Drive.
- Componentes públicos compartilhados em `src/components/envio/`: `moldura.tsx` (fundo, topo e rodapé), `estado-link.tsx` (expirado, desativado, indisponível, com "Falar no WhatsApp" quando houver número), `seletor.tsx` (área de soltar e botões), `fila-publica.tsx` (progresso).

### 8.2 Freela: `/enviar/<token>`

**Título: 3 variações**
1. **"Do cartão para a ZRO."** (escolhida: o caminho inteiro em cinco palavras, no tom da marca)
2. "Material da diária."
3. "Descarregue o cartão."

**Botão principal: 3 variações**
1. **"Escolher o cartão"** (escolhida: diz o objeto certo, a pasta inteira)
2. "Selecionar cartão"
3. "Abrir o cartão"

**Fluxo da tela** (rótulo "ENVIO DE MATERIAL"; subtítulo "Verão Pipa · Diária 02 · quinta, 12 de março")
1. **"01 · QUEM É VOCÊ"**: botões com as pessoas da escala ("Rafael M. · Captação com câmera") e "Não estou na lista" (abre "Seu nome").
2. **"02 · QUAL CÂMERA"**: Câm A, Câm B, Câm C, Drone, Câm E, Foto, Gravador. Gravador abre "Qual gravador?" (placeholder "Zoom F6", com sugestões dos já usados no projeto).
3. **"03 · O CARTÃO"**: **Escolher o cartão** (pasta), "Escolher arquivos" (secundário) e, no computador, "Ou arraste o cartão para cá."
4. **Resumo:** "128 arquivos · 212,4 GB" + "Vai para Câm A · Rafael Moura, num rolo novo." + **Começar envio**.
5. **Enviando:** "Rolo A003" grande; "38% · 80,6 GB de 212,4 GB · 42 MB/s · faltam 52 min"; lista recolhida dos arquivos; "Deixe esta página aberta até terminar."

| Estado | Texto |
|---|---|
| Não encontrado | 404 padrão (`not-found.tsx`) |
| Expirado | rótulo "LINK EXPIRADO" · h1 "Este link expirou." · "Peça um novo para a produção da ZRO." · "Falar no WhatsApp" |
| Desativado | h1 "Este link não está mais ativo." · "Peça um novo para a produção da ZRO." |
| Indisponível (Google fora, pasta sumida) | h1 "Não dá para receber o material agora." · "Avise a produção da ZRO." |
| Sem pessoa | "Toque no seu nome para continuar." |
| Sem câmera | "Escolha a câmera deste cartão." |
| No celular | "No celular, mande arquivos soltos. O cartão inteiro vai pelo computador." |
| Ignorados | "3 arquivos do sistema ficaram de fora (.DS_Store e parecidos)." |
| Mesmo cartão (pergunta) | "Este cartão já subiu como rolo A003. Os arquivos novos entram no A003?" · **Entrar no A003** · "Rolo novo" |
| Retomável | "O rolo A003 parou em 38%. Escolha o mesmo cartão para continuar." |
| Sem internet | "Sem internet. O envio continua sozinho quando a conexão voltar." |
| Recomeçando | "O envio deste arquivo expirou no Google. Recomeçando." |
| Erro num arquivo | "Não deu para enviar este arquivo. Toque em Tentar de novo: continua de onde parou." |
| Parcial | "126 de 128 arquivos chegaram. Toque em Tentar de novo no que faltou." |
| Limite do link | "Este link aceita até 2 TB. Ainda cabem 300 GB." |
| Concluído | h2 **"Rolo A003 recebido."** · "128 arquivos conferidos no Drive, com o tamanho exato. Guarde o cartão até a ZRO confirmar." · **Enviar outro cartão** |
| Concluído (áudio) | h2 "Áudio recebido." · "12 arquivos do Zoom F6 conferidos no Drive." |

**Concluído: 3 variações do título**
1. **"Rolo A003 recebido."** (escolhida: o número é o que o freela anota)
2. "Chegou inteiro."
3. "Material na ZRO."

### 8.3 Cliente: `/cliente/<token>`

**Título: 3 variações**
1. "Seus filmes com a ZRO."
2. "Tudo do seu projeto, aqui."
3. **"<Cliente>"** com o subtítulo "Seus projetos com a ZRO." (escolhida: o nome do cliente é a âncora mais pessoal e não vira slogan)

**Seção de entregas: 3 variações**
1. **"Arquivos finais"** (escolhida)
2. "Entregas"
3. "Para baixar"

**Seção de envio: 3 variações**
1. "Mande seus arquivos."
2. **"Envie para a ZRO."** (escolhida) com o subtítulo "Logo, manual de marca, referências. Vai direto para a pasta do projeto."
3. "Arquivos da sua empresa."

**Tela pronta** (rótulo "ÁREA DO CLIENTE")
- Um bloco por projeto: título, mês ("março de 2026") e **Arquivos finais**, agrupados em Master, Redes, Legendas e Outros. Cada arquivo: nome, tamanho, **Baixar** (`baixarUrl`) e **Ver** (`verUrl`, prévia do Google).
- Nota curta abaixo da lista: "Arquivos grandes abrem uma página do Google antes de baixar."
- **Envie para a ZRO:** Select "Para qual projeto?" (os projetos + "Arquivos da empresa, sem projeto"), "Assunto" (placeholder "Manual de marca"), Checkbox de consentimento, **Escolher arquivos** e "Escolher pasta" (no computador), área de soltar.
- **Você já enviou:** os 10 últimos ("13/03 · Manual de marca · 4 arquivos · 12 MB").

| Estado | Texto |
|---|---|
| Não encontrado | 404 padrão |
| Desativada | h1 "Esta área não está mais ativa." · "Fale com a ZRO." |
| Pede senha | rótulo "ÁREA PROTEGIDA" · h1 "Digite a senha." · **Entrar** (molde de `/entrar`, coluna de 380 px) |
| Senha errada | "A senha não confere. Confira com quem te mandou o link." |
| Muitas tentativas | "Muitas tentativas. Espere 15 minutos e tente de novo." |
| Google fora | Os projetos aparecem; no lugar dos arquivos: "Os arquivos estão indisponíveis agora. Avise a ZRO." Envio desligado. |
| Projeto sem entrega liberada | "Os arquivos finais aparecem aqui quando estiverem prontos." |
| Nenhum projeto | "Nenhum projeto por aqui ainda." |
| Sem consentimento | "Precisamos do seu ok para receber os arquivos." |
| Sem assunto | "Diga do que se trata (ex.: manual de marca)." |
| Limite do dia | "Hoje dá para enviar mais 4,2 GB. O limite volta amanhã." |
| Sessão da senha caiu no meio | Modal com o campo de senha; a fila espera e continua depois. |
| Enviando, parcial, sem internet, erro, retomável | Os mesmos textos da 8.2, falando de "arquivos" |
| Concluído | h2 **"Recebido."** · "4 arquivos chegaram na pasta do projeto." · **Enviar mais** |

**Consentimento:** "Concordo que a ZRO guarde estes arquivos para o projeto, como explica a [Política de Privacidade](/privacidade)."

**Senha** (`src/app/cliente/[token]/actions.ts`, Server Action pública): zod → `entrarNaArea(token, senha)` (BASE) → `redirect` para a própria área. `entrarNaArea`: link ativo; limite de tentativas; `verifyPassword` (ou contra um hash fixo, para o tempo não variar); grava o cookie `zro_area` (httpOnly, `secure` em produção, `sameSite: "lax"`, `path: /cliente/<token>`, 30 dias, JWT HS256 com `chaveDerivada("zro:area-cliente")`, claims `{ l: linkId, v: senhaVersao }`).

### 8.4 Busca, privacidade e cabeçalhos

- **`src/app/robots.ts`:** `disallow: ["/painel", "/entrar", "/enviar", "/cliente"]`. `sitemap.ts` não muda.
- **`next.config.ts`:** duas regras **depois** da global (na Next, a última regra que casa vence para a mesma chave), para `/enviar/:path*` e `/cliente/:path*`:
  ```ts
  const googleApi = !process.env.VERCEL && process.env.NODE_ENV !== "production" && process.env.ZRO_GOOGLE_API_BASE
    ? process.env.ZRO_GOOGLE_API_BASE : "https://www.googleapis.com";
  const envioHeaders = [
    { key: "Content-Security-Policy", value: `frame-ancestors 'self'; connect-src 'self' ${googleApi}; form-action 'self'; base-uri 'self'` },
    { key: "Referrer-Policy", value: "no-referrer" },          // o token da URL não vaza para o Google ao clicar em Baixar
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ];
  // headers(): [{ source: "/:path*", headers: securityHeaders },
  //             { source: "/enviar/:path*", headers: envioHeaders }, { source: "/cliente/:path*", headers: envioHeaders }]
  ```
  Em dev (o React precisa), `connect-src` ganha `ws:`. A CSP global e a `Permissions-Policy` não mudam.
  **Atualização (§16):** `/cliente/*` usa `Referrer-Policy: strict-origin` (só a origem, nunca o código do link) e `frame-src 'self' https://drive.google.com`, por causa da prévia das entregas.
- **`src/app/(site)/privacidade/page.tsx`** (texto para o Victor e o Edu revisarem):
  - **Quais dados coletamos**, novo parágrafo: "Na área do cliente e nos links de envio da ZRO, guardamos os arquivos enviados, quem enviou (o nome do cadastro ou o que for informado), a data e, no caso de clientes, o aceite."
  - **Com quem compartilhamos**, acrescentar: "Os arquivos ficam no Google Drive da ZRO, no Google Workspace. O Google é o operador do armazenamento."
  - **Por quanto tempo**: mantém a fórmula atual ("Enquanto for necessário… apagados ou anonimizados"). Nenhum prazo novo é prometido.
  - **Cookies**, acrescentar: "Na área do cliente com senha, um cookie técnico guarda o acesso por 30 dias."

---

## 9. Ajustes → Google Drive e o teste de envio direto

### Arquivos (BASE)

| Arquivo | Responsabilidade |
|---|---|
| `ajustes/ajustes-tabs.tsx` | A união ganha `"google"`: `{ key: "google", label: "Google Drive", href: "/painel/ajustes/google" }`, depois de "Dados e backup". |
| `ajustes/google/page.tsx` | `requireUser()`, `<PageHeader label="Ajustes" title="Google Drive" />`, `<AjustesTabs active="google" />`, grade `xl:grid-cols-12`. Lê `?ok=1` e `?erro=` para o aviso. |
| `ajustes/google/google-forms.tsx` | "use client": `ConectarGoogle` (um `<a href="/api/google/conectar">`, não `Link`; no app da tela inicial mostra "Abra pelo navegador do computador para conectar."), `DesconectarGoogle`, `PastaRaizForm`, `AcessoEquipeForm`, `CriarPastasAtivos`. |
| `ajustes/google/diagnostico.tsx` | "use client": roda o motor com um arquivo gerado de 512 KiB em pedaços de 256 KiB e mostra o resultado. |
| `ajustes/google/actions.ts` | `desconectarGoogleAction`, `salvarPastaRaizAction` (nome → `garantirPasta("root", nome)`; link → `idDePastaDoLink` + `arquivo()`), `darAcessoEquipeAction`, `tirarAcessoEquipeAction`, `criarPastasAtivosAction` (até 10 projetos ativos sem pasta, com `after()`: "Criando em segundo plano."). |
| `src/app/api/google/conectar/route.ts` | GET. `paraOficial` → oficial. `getSessionUser()` ou `/entrar?next=/painel/ajustes/google`. Sem config → `?erro=config`. `state` (32 bytes) + PKCE. Cookie `zro_google_oauth` (JWT `{ s, v, u, t }`, `chaveDerivada("zro:google-oauth")`, httpOnly, secure, lax, `path=/api/google`, 600 s). 302 para o consentimento. `?trocar=1` liga `t`. |
| `src/app/api/google/callback/route.ts` | GET (passos abaixo). |
| `src/app/(painel)/painel/arquivos/api/route.ts` | `export const POST = rotaEnvioPainel()`. Serve Arquivos e o diagnóstico. |

**`/api/google/callback`**
1. `paraOficial`. Sessão do painel igual ao `u` do cookie (senão `?erro=sessao`).
2. `state` igual ao do cookie, em comparação de tempo constante (senão `?erro=estado`).
3. `error` vindo do Google → `?erro=negado`.
4. `trocarCodigo`. Sem `refresh_token` → `?erro=sem_refresh`. Escopo sem `DRIVE_SCOPE` exato → `?erro=permissao`.
5. `sobre()`. Conta diferente da conectada, com pastas já criadas, e sem `t` → **não grava**, `?erro=outra_conta&nova=<e-mail>`.
6. `salvarConexao` (com `trocar` quando `t`), `garantirRaiz()`.
7. Apaga o cookie e volta para `/painel/ajustes/google?ok=1`.

### Cards da página

| Card | Conteúdo |
|---|---|
| Aviso (`border-warn/40`) | Só com `sem-config`: "Faltam GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET ou ZRO_DRIVE_KEY na Vercel." |
| **Conta Google** | Badge Conectado (`ok`) / Desconectado / Reconectar (`warn`); e-mail; espaço ("1,2 TB usados de 2 TB" ou "Espaço do Workspace"); "Enviado nas últimas 24 h: 80 GB de 750 GB"; **Conectar Google** / **Reconectar** / **Desconectar** (ConfirmAction: "Desconectar o Google Drive?" "Links e área do cliente param até conectar de novo. Nada é apagado do Drive." + "3 envios em andamento vão parar." quando houver). |
| **Pasta raiz** | "ZRO" com caminho, **Abrir no Drive**, **Trocar** (FormModal: "Nome ou link da pasta"). Projetos já criados ficam onde estão. |
| **Acesso da equipe** | E-mails Google com acesso de edição à raiz (motivo `equipe`), **Dar acesso** (FormModal com o e-mail) e **Remover**. |
| **Projetos sem pasta** | "12 projetos ativos sem pasta no Drive." + **Criar pastas dos projetos ativos**. |
| **Teste de envio direto** | **Testar neste aparelho** e o resultado; abaixo, os últimos testes por aparelho ("Chrome · macOS · 14/10 · ok"). |

**Avisos do `?erro=`:** `config` "Faltam as chaves do Google na Vercel." · `sessao` "Entre de novo e conecte." · `estado` "A conexão demorou demais. Tente de novo." · `negado` "O Google não autorizou." · `sem_refresh` "O Google não mandou o acesso contínuo. Remova o app em myaccount.google.com/permissions e conecte de novo." · `permissao` "Marque a permissão do Google Drive ao conectar." · `outra_conta` "Você entrou com <nova>, diferente da conta conectada (<atual>)." + **Trocar para <nova>** (→ `/api/google/conectar?trocar=1`). `?ok=1`: toast "Google conectado."

### O teste (substitui o curl; roda no navegador de verdade)

1. `diagnostico.tsx` gera `new File([512 KiB aleatórios], "zro-teste-envio.bin")` e chama `motor.adicionar(selecao, { tipo: "pasta", pastaId: <raiz> })` pelo transporte `/painel/arquivos/api`. O servidor abre a sessão com o `Origin` da página, como em qualquer envio.
2. O motor (`diagnostico: true`, `pedacoMiB: 0.25`) manda os dois pedaços e registra:
   - **preflight** (o primeiro `PUT` não deu status 0);
   - **308 legível**;
   - **Range legível**;
   - **resposta final legível** (só informativo);
   - **host da sessão** (`new URL(sessao).host`).
3. `conferir` normal (o servidor confere o tamanho) e `diagnostico { envioId, resultado }` (o `envioId` vem de `foto().itens`): o servidor manda o arquivo de teste para a **lixeira** (nunca apaga de vez) e grava o resultado em `drive_conexao.diagnosticos` (últimos 12, navegador resumido como "Chrome · macOS", nunca o user agent inteiro).
4. A tela mostra 5 linhas ok/falhou. **Onde rodar:** Chrome no computador, Safari no iPhone e o app da tela inicial.

### Portão de decisão

| Resultado | Ação |
|---|---|
| preflight ok, 308 legível, Range legível | Mantém o envio direto (esperado). Resposta final ilegível não importa. |
| preflight ok, 308 legível, Range **ilegível** | Mantém o envio direto. O motor pega o offset pelo servidor (`conferir`) a cada pedaço: mais chamadas, mesmo resultado. |
| preflight ou 308 com falha | O envio direto não funciona nesse navegador. A tela diz "Este navegador não conseguiu enviar direto ao Google. Mande este resultado para o Claude." Abre-se a evolução abaixo. |
| host diferente de `www.googleapis.com` | Acrescentar o host ao `connect-src` de `/enviar` e `/cliente`. |

### Evolução, se o direto falhar (só documentado)

- **Painel:** segunda autorização só com `drive.file`, refresh guardado à parte. O servidor gera um token de cerca de 1 h só para quem está logado, e o navegador abre a sessão sozinho (caminho oficial do Google). A pasta de destino precisa ter sido criada pelo app (as da estrutura são).
- **Freela e cliente:** nunca entregar token a visitante (um token `drive.file` enxergaria por 1 hora tudo o que o app criou, e não dá para revogar um só). Opções: relay pela Vercel com teto por arquivo baixo, ou o Google Cloud Storage como zona de pouso (CORS documentado; cópia para o Drive por um job; custo e infraestrutura a mais).
- **Em qualquer caminho ficam:** conclusão e conferência no servidor, retomada pela consulta, pedaços de 256 KiB e os contornos do iOS.

---

## 10. Segurança e LGPD (lista para conferir no código)

- [ ] O refresh token só existe em `google/conexao.ts`/`oauth.ts` (`server-only`). Nunca em resposta, prop, log ou backup. O token de acesso nunca vai ao navegador.
- [ ] A URI da sessão só sai na resposta de `iniciar`, para o escopo dono do envio. Cifrada no banco, apagada ao concluir, cancelar ou expirar. Nunca em log, `localStorage`, interface ou diagnóstico (só o host).
- [ ] O servidor só faz `PUT`/`DELETE` numa URI que passe em `sessaoPermitida`.
- [ ] Toda rota nova confere Origin (lista + igual ao host), sessão ou token, `Content-Type`, tamanho do corpo e responde com `no-store`. As Server Actions já têm a checagem de origem da Next.
- [ ] **IDOR:** lote e envio sempre buscados com o filtro do escopo; `freelancerId` conferido na escala da diária; `projetoId` do cliente conferido contra o `clientId` do link; nenhum id de pasta vem do navegador nas rotas públicas; o painel valida o formato do id e se é pasta.
- [ ] A área do cliente só lista `entregasId` guardados no banco para projetos daquele cliente, e só depois de "Liberar entregas".
- [ ] O id do arquivo vem da sessão (ou da busca por `appProperties`), nunca do navegador. `files.get` confere `parents`, `size` e lixeira.
- [ ] Concluir é atômico (`WHERE estado='enviando' RETURNING`); o histórico é gravado uma vez (`avisadoEm`).
- [ ] Token de link com 256 bits; o banco guarda o hash para busca e a cifra só para o painel mostrar. Senha com bcrypt. Cookie da área com chave derivada só para isso, `path` limitado e derrubado quando a senha muda (`senhaVersao`).
- [ ] Tentativas de senha: 5 em 15 minutos por link (`login_attempts`, `ip: null`) e 20 por hora por IP só em memória.
- [ ] Nomes: controle e bidi removidos (teste com `\u202E`); pastas da ZRO limpas para Mac e Windows; valores das consultas ao Drive escapados; `mimeType` nunca nos metadados; `vnd.google-apps.*` vira `octet-stream`.
- [ ] Nenhum pré-limite pelo tamanho declarado (o Google recusa e a mensagem chega certa).
- [ ] CSP e `Referrer-Policy: no-referrer` em `/enviar` e `/cliente`; fora da busca (`robots`, `noindex`, fora do sitemap).
- [ ] Prévias: `/api/google/*` vai para o endereço oficial; `/enviar` e `/cliente` dão 404. `src/proxy.ts` intacto.
- [ ] Falta de `ZRO_DRIVE_KEY` não derruba página nenhuma (só `selar`/`abrir` lançam).
- [ ] **LGPD:**
  - o freela aparece como "Rafael M." na página pública; telefone, e-mail e CPF nunca saem;
  - o cliente vê só os próprios projetos e as entregas liberadas;
  - consentimento obrigatório no envio do cliente (`consentimentoEm`); o freela envia material de trabalho, sob o contrato da diária;
  - IP não é guardado;
  - o e-mail do cliente só recebe o compartilhamento quando o Victor libera as entregas;
  - pedido de exclusão é atendido à mão (arquivo no Drive e registro no banco).

---

## 11. Variáveis e documentação

| Variável | Onde | Valor |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Vercel (Production) e `.env.local` | ID do cliente "Aplicativo da Web" do projeto "ZRO Site" |
| `GOOGLE_CLIENT_SECRET` | Vercel (Production, **Sensitive**) | segredo do cliente |
| `ZRO_DRIVE_KEY` | Vercel (Production, **Sensitive**) | `openssl rand -base64 32` (32 bytes). Guardar no gerenciador de senhas. |
| `ZRO_GOOGLE_API_BASE` | **só local e testes**; ignorada na Vercel e em produção | `http://127.0.0.1:54400` (mock) |
| `GOOGLE_API_KEY` | Vercel (Production), **opcional** | chave de API restrita à Drive API e ao referenciador `https://zrofilmes.vercel.app/*` (§16). Sem ela, o cliente assiste pelo player do Google Drive. |

Sem variável de modo: só existe o envio direto.

### `DEPLOY.md`: seção nova "5. Google Drive (pastas, envios e área do cliente)"

O texto é o passo a passo da seção 0 ("O que você faz uma vez"), com mais estas notas:
- Na lista do topo ("O que o código já faz sozinho"), uma linha: "Drive: cria as pastas de cada projeto, recebe material de freelas e clientes direto no Google Drive e mostra as entregas na área do cliente."
- **Domínio próprio** (em "Depois"): cadastrar também o novo endereço de retorno no cliente OAuth do Google (`https://<domínio>/api/google/callback`).
- **Se trocar `SESSION_SECRET`:** o Drive continua; quem tem área com senha digita de novo.
- **Se perder `ZRO_DRIVE_KEY`:** crie outra, Redeploy, **Reconectar** em Ajustes e **Trocar link** nas diárias e áreas ativas. Nada some do Drive nem do banco.
- **Custos:** nenhum serviço novo. O espaço é o do Workspace. Limite do Google: 750 GB de envio por dia por conta (se o SOBEDESCE usar a mesma conta, divide o limite).
- **Cliente OAuth sem uso por 6 meses é apagado pelo Google:** se o Drive ficar parado tanto tempo, conferir o cliente no console.

### Outros documentos

- **`.env.example`:** troca o bloco Turso pelo Postgres atual (`DATABASE_URL` do Neon; local vazio = PGlite) e acrescenta o bloco "Google Drive" com as variáveis acima.
- **`README.md`:** corrige "Publicar (Vercel + Turso)" para Postgres/Neon e acrescenta "Google Drive", apontando para `DEPLOY.md` e este arquivo.
- **`CLAUDE.md`:** uma linha nova em Status depois do merge (o orquestrador faz).
- **Este arquivo:** a verificação acrescenta, no fim, a seção "Registro" com os resultados reais (diagnóstico por aparelho, e2e, screenshots).

---

## 12. Lista exata de arquivos

**Ordem:** BASE primeiro (contrato, schema e serviços). Depois PAINEL e PÚBLICO em paralelo. Por último a verificação. **Nenhum arquivo aparece em dois blocos.** N = novo, M = modificado.

As três rotas de envio (`/painel/arquivos/api`, `/enviar/<token>/api`, `/cliente/<token>/api`) ficam na BASE, mesmo morando em pastas do PAINEL e do PÚBLICO: são o protocolo, e a BASE precisa delas para testar tudo (diagnóstico e `drive-e2e-protocolo.mjs`) antes de existir qualquer tela. As páginas dessas pastas são dos outros blocos.

### 12.1 BASE

| Arquivo | N/M | O quê |
|---|---|---|
| `src/lib/db/schema.ts` | M | 8 tabelas (seção 3) |
| `drizzle/0008_drive.sql`, `drizzle/meta/0008_snapshot.json`, `drizzle/meta/_journal.json` | N/M | migração gerada e revisada |
| `src/lib/drive/protocolo.ts` | N | contrato (tipos, zod, mensagens) |
| `src/lib/drive/estrutura.ts` | N | estrutura, fontes, nomes de pasta |
| `src/lib/drive/nomes.ts` | N | limpeza de nomes, ids, lixo do sistema |
| `src/lib/drive/bytes.ts` | N | formatos de tamanho, velocidade e tempo |
| `src/lib/drive/rota.ts`, `src/lib/drive/limites.ts` | N | rotas de envio e limites |
| `src/lib/drive/navegador/motor.ts`, `rede.ts`, `transporte.ts`, `selecao.ts`, `retomar.ts`, `plataforma.ts`, `tela-acesa.ts`, `use-motor.ts` | N | motor do navegador |
| `src/lib/google/config.ts`, `cripto.ts`, `oauth.ts`, `conexao.ts`, `drive.ts`, `erros.ts`, `previa.ts` | N | camada Google |
| `src/lib/services/drive-pastas.ts`, `drive-envios.ts`, `drive-links.ts`, `drive-entregas.ts`, `drive-publico.ts` | N | serviços |
| `src/lib/services/projects.ts` | M | `createProject` chama `await agendarPastasDoProjeto(row.id)` |
| `src/lib/services/activity.ts` | M | tipo `"arquivos"` e `logClientActivity` |
| `src/app/api/google/conectar/route.ts`, `src/app/api/google/callback/route.ts` | N | OAuth |
| `src/app/(painel)/painel/arquivos/api/route.ts` | N | rota de envio do painel (e do diagnóstico) |
| `src/app/enviar/[token]/api/route.ts`, `src/app/cliente/[token]/api/route.ts` | N | rotas de envio públicas (3 linhas cada) |
| `src/app/(painel)/painel/ajustes/google/page.tsx`, `google-forms.tsx`, `diagnostico.tsx`, `actions.ts` | N | Ajustes → Google Drive |
| `src/app/(painel)/painel/ajustes/ajustes-tabs.tsx` | M | aba "Google Drive" |
| `scripts/google-mock/mock-drive.mjs`, `scripts/google-mock/servidor.mjs` | N | mock copiado e estendido |
| `scripts/tests/drive-nomes.test.mts`, `drive-estrutura.test.mts`, `drive-protocolo.test.mts`, `drive-cripto.test.mts`, `drive-motor.test.mts` | N | testes puros e do motor contra o mock |
| `scripts/drive-e2e-protocolo.mjs` | N | e2e das três rotas, sem interface |
| `DEPLOY.md`, `.env.example`, `README.md` | M | documentação |

**`drive-links.ts`** (contrato para PAINEL e PÚBLICO):
```ts
export type LinkDTO = { id: string; tipo: "freela-diaria" | "cliente-area"; url: string | null; estado: "ativo" | "expirado" | "desativado";
  expiraEm: Date | null; temSenha: boolean; limiteBytes: number | null; rotulo: string; criadoEm: Date; ultimoUsoEm: Date | null };
export async function linkDaDiaria(eventId: string, o: { criar: boolean; userId: string }):
  Promise<{ ok: true; link: LinkDTO | null; diaria: DiariaDTO | null; rolos: number } | { ok: false; mensagem: string }>;
export async function areaDoCliente(clientId: string, o: { criar: boolean; userId: string; senha?: string | null; limiteDiarioGB?: number | null }):
  Promise<{ ok: true; link: LinkDTO | null } | { ok: false; mensagem: string }>;
export async function trocarLink(linkId: string, userId: string): Promise<LinkDTO>;
export async function desativarLink(linkId: string, o: { userId: string; cancelarEnvios: boolean }): Promise<{ cancelados: number }>;
export async function definirSenha(linkId: string, senha: string | null): Promise<void>;          // muda senhaVersao
export async function definirValidade(linkId: string, expiraEm: Date | null): Promise<void>;
export async function definirLimite(linkId: string, limiteBytes: number | null): Promise<void>;
export async function revogarLinksDe(ref: { projectId?: string; eventId?: string; clientId?: string }): Promise<number>;
export function textoWhatsAppDiaria(i: { data: string; projeto: string; url: string }): string;
export function textoWhatsAppArea(i: { contato: string | null; cliente: string; url: string; temSenha: boolean }): string[];
export async function entrarNaArea(token: string, senha: string): Promise<{ ok: true } | { ok: false; erro: "senha" | "muitas_tentativas" | "inativo" }>;
```
Validade padrão da diária: 23:59:59 (America/Fortaleza) do 30º dia depois do fim da diária. Área: sem validade, limite de 50 GB por dia.

### 12.2 PAINEL

| Arquivo | N/M | O quê |
|---|---|---|
| `src/components/painel/nav.ts` | M | item "Arquivos" |
| `src/app/(painel)/painel/arquivos/page.tsx` | N | página (servidor) |
| `src/app/(painel)/painel/arquivos/navegador.tsx` | N | lista, trilha, seleção e arrastar ("use client") |
| `src/app/(painel)/painel/arquivos/fila.tsx` | N | fila de envio do painel ("use client") |
| `src/app/(painel)/painel/arquivos/arquivos-dialogs.tsx` | N | Nova pasta |
| `src/app/(painel)/painel/arquivos/actions.ts` | N | `criarPastaAction` |
| `src/lib/queries/drive-painel.ts` | N | lotes recentes, do projeto, do cliente; diárias com link e rolos |
| `src/app/(painel)/painel/projetos/[id]/page.tsx` | M | aba Drive e contagem |
| `src/app/(painel)/painel/projetos/[id]/_tabs/drive-tab.tsx` | N | aba Drive (servidor) |
| `src/app/(painel)/painel/projetos/[id]/_components/drive-dialogs.tsx` | N | botões e janelas da aba |
| `src/app/(painel)/painel/projetos/drive-actions.ts` | N | actions de pastas, links da diária e entregas |
| `src/app/(painel)/painel/projetos/actions.ts` | M | `deleteProject` revoga links |
| `src/app/(painel)/painel/agenda/agenda-dialogs.tsx` | M | `InfoRow` "Material" |
| `src/app/(painel)/painel/agenda/diaria-envio.tsx` | N | link da diária na janela |
| `src/app/(painel)/painel/agenda/actions.ts` | M | `deleteEvent` revoga links |
| `src/app/(painel)/painel/crm/clientes/[id]/page.tsx` | M | aba "Área do cliente" |
| `src/app/(painel)/painel/crm/clientes/[id]/area-tab.tsx` | N | aba (servidor) |
| `src/app/(painel)/painel/crm/area-dialogs.tsx` | N | janelas da área |
| `src/app/(painel)/painel/crm/area-actions.ts` | N | actions da área |
| `src/app/(painel)/painel/crm/crm-ui.tsx`, `crm-options.ts` | M | ícone e rótulo "Arquivos" |
| `src/app/(painel)/painel/crm/actions.ts` | M | `deleteClient` revoga a área |
| `src/lib/queries/backup.ts` | M | tabelas novas sem segredos |
| `src/app/(painel)/painel/ajustes/demo-data.ts` | M | `set null` e revogação dos exemplos |
| `scripts/drive-e2e-painel.mjs` | N | e2e do painel |

### 12.3 PÚBLICO

| Arquivo | N/M | O quê |
|---|---|---|
| `src/app/enviar/[token]/page.tsx` | N | página do freela (servidor) |
| `src/app/enviar/[token]/envio-freela.tsx` | N | fluxo do freela ("use client") |
| `src/app/cliente/[token]/page.tsx` | N | área do cliente (servidor) |
| `src/app/cliente/[token]/area-cliente.tsx` | N | envio do cliente ("use client") |
| `src/app/cliente/[token]/entregas.tsx` | N | lista das entregas (servidor) |
| `src/app/cliente/[token]/senha-form.tsx` | N | formulário de senha |
| `src/app/cliente/[token]/actions.ts` | N | `entrarAction` |
| `src/components/envio/moldura.tsx`, `estado-link.tsx`, `seletor.tsx`, `fila-publica.tsx` | N | componentes públicos |
| `next.config.ts` | M | cabeçalhos de `/enviar` e `/cliente` |
| `src/app/robots.ts` | M | `/enviar` e `/cliente` fora da busca |
| `src/app/(site)/privacidade/page.tsx` | M | texto sobre arquivos recebidos |
| `scripts/drive-e2e-publico.mjs` | N | e2e das páginas públicas |

### 12.4 Contrato entre blocos

- PAINEL e PÚBLICO só importam da BASE: `@/lib/drive/protocolo`, `estrutura`, `nomes`, `bytes`, `navegador/*`; `@/lib/google/conexao` (`statusDrive`, `driveConectado`); `@/lib/google/drive` (`listarPasta`, `caminhoDaPasta`, `listarDrivesCompartilhados`, `criarPasta`, `arquivo`); `@/lib/services/drive-pastas`, `drive-links`, `drive-entregas`, `drive-envios` (`conciliarParados`, `marcarLotesVistos`), `drive-publico`; `@/lib/services/activity`.
- As assinaturas desta seção, da seção 4, 5, 6 e 8.1 estão **congeladas**. Se uma estiver errada, a BASE faz a menor mudança, mantém a compatibilidade e relata.
- Consultas de leitura só para tela ficam em cada bloco (`queries/drive-painel.ts`; o PÚBLICO lê tudo por `abrirLinkPublico`).

### 12.5 Não tocados

`src/proxy.ts`, `scripts/db-setup.mts`, `src/lib/db/config.ts`, `src/lib/db/summary.ts`, `src/lib/db/defaults.ts`, `src/lib/settings.ts`, `src/lib/domain.ts`, `src/lib/format.ts`, `src/components/ui/*`, `src/components/painel/form.tsx`, `bits.tsx`, `shell.tsx`, `src/app/(painel)/painel/layout.tsx`, `quadro/*`, `ajustes/dados/*`, `ajustes/actions.ts`, `vercel.json`, `package.json`.

---

## 13. Verificação

### 13.1 Antes de começar

- Ler `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `03-api-reference/03-file-conventions/route.md`, `03-api-reference/04-functions/after.md`, `cookies.md` e `05-config/01-next-config-js/headers.md` (exigência do `AGENTS.md`).

### 13.2 Estático (cada bloco, antes de terminar)

- `npm run typecheck` **completo** e `npm run lint`, os dois limpos.
- `grep -rnE "console\.(log|error|warn)\(.*(sessao|refresh|token|location|Location)" src/` → vazio.
- `grep -rn "ZRO_GOOGLE_API_BASE" src/` → só `src/lib/google/config.ts` (e o `next.config.ts`).
- `grep -rn "@dissesim\|zro.contato@gmail" src/` → vazio (nenhum e-mail fixo).
- Grep da migração (seção 3) → vazio.

### 13.3 Testes puros e do motor (BASE)

`npx tsx --conditions=react-server --test scripts/tests/drive-*.test.mts`
- `nomes`: barras, `:` e `?` em pasta, controles, `\u202E`, emoji, 300 caracteres, nomes reservados do Windows; `nomeDeArquivo` não mexe em `MVI_0001.MP4`, `C0001.MP4`, `A001C003_230312_R1AB.mxf`; `idDePastaDoLink` com `/u/1/` e `?usp=sharing`; lixo do sistema.
- `estrutura`: os nomes exatos das 7 pastas e subpastas; `rotuloRolo` (1 → A001, 1000 → A1000); `nomeDiaria`.
- `protocolo`: esquemas zod (limites de 50, tamanho negativo, `vnd.google-apps`), leitura de `Range`, alinhamento de 256 KiB.
- `cripto`: ida e volta, tag adulterada, AAD trocada, chave errada.
- `motor` (Node, `redeFetch`, mock numa porta livre, transporte falso que abre sessões direto no mock): 3 arquivos com quedas (`dropUploadProb 0.2`, `error5xxProb 0.05`) chegam com md5 igual; `sessionTtlMs: 2000` recomeça pelo caminho `conferir` → `iniciar`; `Range` escondido usa o offset do servidor; resposta final sem CORS conclui pelo `conferir`; 0 byte.

### 13.4 Mock do Google (`scripts/google-mock/`, BASE)

- `mock-drive.mjs` = cópia de `/home/user/baixadordodrive/test/mock-drive.js` com cabeçalho "copiado do SOBEDESCE em 2026-10-15; mudanças marcadas com `// ZRO:`". Mudanças:
  1. `DRIVE_SCOPE` como constante local (sai o import de `../src/config.js`).
  2. Opção `port` (fixa) em `_listen`.
  3. `appProperties` guardado no `_insert`, devolvido em `fields` e aceito em `q` (`appProperties has { key='k' and value='v' }`).
  4. `webContentLink` (`https://drive.google.com/uc?id=<id>&export=download`) nos arquivos.
  5. `permissions` em `files/<id>/permissions` (POST cria, GET lista, DELETE remove), com `sendNotificationEmail`/`emailMessage` contados em `stats().emailsDeCompartilhamento`; opção `bloquearLinkPublico` (403 `publishOutNotPermitted`).
  6. `corsModo: "google"`: a sessão guarda o `Origin` da abertura; `PUT`/`OPTIONS` da sessão só têm CORS se o `Origin` bate; opções `expoeRange` (padrão `true`) e `finalSemCors` (padrão `true`, como medido no Google). `corsModo: "aberto"` mantém o `*` de hoje.
- `servidor.mjs`: sobe em `127.0.0.1:54400` com `{ port: 54400, corsModo: "google", client: { clientId: "zro-teste.apps.googleusercontent.com", clientSecret: "GOCSPX-zro-teste" }, user: { emailAddress: "contato@dissesim.com.br", displayName: "ZRO Filmes" } }` e um controle em `127.0.0.1:54401`:
  - `POST /opcoes` → `setOptions(body)`; `POST /revogar` → `revokeRefreshTokens()`; `POST /expirar` → `expireAccessTokens()`; `POST /zerar-dia` → `resetDailyUsage()`; `GET /stats`; `GET /arquivos?pasta=<id>` (nome, tamanho, md5, pais, `appProperties`, permissões).
- `.env.local` (só local, nunca versionado):
  ```
  GOOGLE_CLIENT_ID=zro-teste.apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET=GOCSPX-zro-teste
  ZRO_GOOGLE_API_BASE=http://127.0.0.1:54400
  ```
  (`ZRO_DRIVE_KEY` fica sem valor: a chave de dev é usada.) O OAuth do mock aprova sozinho e aceita `http://localhost:3000/api/google/callback`.

### 13.5 Servidor e banco (só a verificação sobe)

- `node scripts/google-mock/servidor.mjs` e `npm run dev` (um de cada). Com o dev no ar: `ZRO_LOCAL_DB_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres npm run db:migrate`.
- **Build e banco do zero numa cópia isolada** (o dev segura `data/pglite`; nada de `git worktree`): copiar o repositório para o scratchpad sem `node_modules`, `.next` e `data`; `cp -al` do `node_modules` (ou `npm ci` se for outro disco); `npm run db:reset` **lá** (prova 0000 → 0008, a semeadura e "Apagar dados de exemplo" com as tabelas novas); `npm run build`.
- Backup: baixar `/painel/ajustes/dados/backup` logado e conferir que tem as 8 tabelas e que `grep -cE '"(refreshTokenEnc|sessaoEnc|tokenEnc|senhaHash)"'` dá `0` (e que `tokenHash` está lá).

### 13.6 E2E com o mock

Dados de teste com nome começando por "Teste", apagados no fim (SQL por id em `ZRO_LOCAL_DB_URL`). Screenshots no scratchpad da sessão.

- **`drive-e2e-protocolo.mjs` (BASE, sem interface):**
  - conexão por Ajustes (Playwright, `openLogged`); erros com `omitRefreshToken`, `grantedScope` só leitura (`drive.readonly` precisa dar `permissao`), `authDeny`;
  - `garantirPastasDoProjeto` em paralelo (5 vezes) → as 7 pastas e subpastas **sem duplicata** no mock;
  - **10 `lote` simultâneos** de Câm A no mesmo projeto → rolos A001…A010 sem repetição;
  - mesmo cartão (mesma `impressao`) → mesmo `loteId`; cartão com nome igual em 24 h → `pergunta`;
  - `iniciar` em lote de 50, `PUT` pelo Node, `conferir`, `fecharLote` → uma linha só no histórico, mesmo com `fecharLote` duas vezes;
  - `conferir` duas vezes ao mesmo tempo → `arquivosRecebidos` soma uma vez;
  - envio que termina sem `conferir` (e com `ultimo_sinal_em` recuado 3 h por SQL) → `conciliarParados` acha pelo `appProperties` e conclui (nunca `expirado`);
  - área: `projetoId` de outro cliente → 404; senha errada 6 vezes → `muitas_tentativas`; cookie certo → `lote` ok;
  - segurança por `fetch` cru: sem Origin → 403; Origin de fora → 403; `text/plain` → 415; 70 KB → 413; `envioId` de outro link → 404; link expirado → `lote` 409 mas `conferir` de envio já iniciado funciona; link revogado com "cancelar envios" → sessões canceladas no mock.
- **`drive-e2e-painel.mjs` (PAINEL), 1440 e 390:** Arquivos (navegar, Nova pasta, enviar 3 arquivos e uma pasta com `setInputFiles` de diretório, Baixar aponta para `webContentLink`); projeto novo → aba Drive mostra as 7 pastas; projeto com `driveUrl` de fora → usa a pasta; diária → Gerar link → Copiar; CRM → Criar área com senha; Liberar entregas → permissões no mock e e-mail contado; Recolher → permissões removidas; excluir projeto de teste → links revogados, lotes continuam no banco.
- **`drive-e2e-publico.mjs` (PÚBLICO), 390 e 1440:** freela: escolher pessoa, Câm A, pasta-cartão de teste (subpastas `DCIM/100CANON` + um `.DS_Store`) → rolo A001 com a estrutura sem a raiz e sem o `.DS_Store`; recarregar a 40% (`perConnectionBps` baixo) e escolher o mesmo cartão → mesmo rolo, `uploadSessionsCreated` não sobe e `bytesReceived < 1,6 × tamanho`; Gravador → pasta do gravador; cliente: senha, entregas liberadas com Baixar/Ver, envio com consentimento para "03 Assets/Do cliente/<hoje> · Teste"; estados expirado, desativado e indisponível (`/revogar` no mock); `curl -sI http://localhost:3000/enviar/x` mostra a CSP nova, `no-referrer`, `X-Robots-Tag` e a mesma `Permissions-Policy`.

### 13.7 Screenshots (1440×900 e 390×844, `--full`)

| Tela | Estados |
|---|---|
| `/painel/ajustes/google` | sem config, desconectado, conectado, reconectar, outra conta, resultado do teste |
| `/painel/arquivos` | desconectado, raiz, pasta vazia, enviando, pausado, concluído, erro, retomável, card "Chegou" |
| `/painel/projetos/<teste>?aba=drive` | sem Google, sem pasta, criando, pronta, entregas liberadas |
| janela da diária | sem link, com link |
| `/painel/crm/clientes/<teste>?aba=area` | sem área, com área e envios |
| `/enviar/<token>` | quem é você, câmera, cartão, resumo, pergunta, enviando, concluído, expirado, desativado, indisponível |
| `/cliente/<token>` | senha, senha errada, pronta com entregas, sem entregas, enviando, concluído, desativada |

Conferir: nada passa da largura a 390 px, alvos ≥ 40 px (44 px no público), `prefers-reduced-motion` respeitado, nenhum erro no console.

### 13.8 Teste com a conta real (uma vez, depois do deploy em `main`)

1. Ajustes → Testar neste aparelho: Chrome no computador, Safari no iPhone e app da tela inicial. Anotar no "Registro".
2. Projeto de teste: pastas criadas em `ZRO/Clientes/…`.
3. Diária de teste: link → no Chrome, um cartão real (ou pasta de 20 GB) → conferir no Drive a estrutura, os tamanhos e o md5.
4. Bloquear a tela do iPhone no meio de um envio e voltar: continua.
5. Mais de 4 GB pelo Safari do Mac (bugs 272600 e 319985 do WebKit).
6. Área do cliente: Liberar entregas com um e-mail de teste → o e-mail do Google chega; Baixar funciona numa janela anônima.
7. `GET /api/versao` para confirmar o commit no ar.

---

## 14. Pendências e riscos

1. **Confirmações do Victor** (seção 0): numeração por projeto, letras D e F, tirar o nome do cartão, validade e limites padrão, frase "Guarde o cartão até a ZRO confirmar", Liberar entregas manual.
2. **CORS da sessão criada pelo servidor ainda não foi visto num navegador com a conta real.** O desenho não depende da resposta final, e um `Range` escondido só custa chamadas a mais. O diagnóstico decide; a evolução está na seção 9.
3. **Workspace:** link "qualquer pessoa" e e-mail para quem não tem conta Google dependem das regras de compartilhamento do admin.google.com. O painel mostra o erro do Google quando bloqueia.
4. **iPhone:** não escolhe pasta (cartão inteiro só pelo computador); a Fotos comprime vídeo (recomendar o app Arquivos); o bug 319985 do WebKit ainda não saiu numa versão pública (contorno no motor); em segundo plano o envio para (Wake Lock e retomada).
5. **Renomear** projeto ou cliente não renomeia a pasta; **mudar o cliente** do projeto não move a pasta. A aba Drive mostra o caminho real. Ação "Mover/renomear" fica para depois.
6. **Pasta apagada ou movida à mão no Drive:** o cache é só dica; erro 404 invalida e recria. "Recriar o que falta" confere tudo.
7. **Cota do Google:** 750 GB por dia por conta (painel, freelas, clientes e o SOBEDESCE, se usar a mesma conta). A mensagem certa aparece; não há fila automática para o dia seguinte.
8. **Banco:** `drive_envios` cresce uns 350 bytes por arquivo. Acompanhar em Ajustes → Dados; se o Neon Free apertar, compactar envios antigos concluídos num resumo por lote (com OK do Victor, porque mexe em registro).
9. **App SOBEDESCE abrindo os links:** protocolo documentado na seção 5; nada implementado.
10. **Relay e token `drive.file`:** só se o diagnóstico falhar.
11. **Texto da privacidade:** revisar com o Edu (adequação LGPD feita com Sebrae/FUNCERN).
12. **Domínio próprio:** cadastrar o novo endereço de retorno no Google e trocar `NEXT_PUBLIC_SITE_URL`.

---

## 15. Card da Pauta: link para o freela e "Enviar aqui" no card

Card da Pauta ligado a um projeto com pasta no Drive. Duas formas de a peça final chegar na pasta certa, as duas com o mesmo protocolo (§5) e o mesmo motor (§6). Quando o lote fecha, o card ganha a mensagem e os links.

### Link para o freela (`drive_links.tipo = "freela-card"`)

- **Banco (migração 0009, só aditiva):** `drive_links.card_id`, `destino_pasta_id`, `destino_rotulo` ("06 Entregas / Redes" | "05 Render") e o índice único parcial `drive_links_card_ativo_idx` (um ativo por card: `revogado_em is null and tipo = 'freela-card'`); `drive_lotes.card_id`. Nada é apagado: desativar = `revogadoEm`. Validade padrão: 23:59:59 em Natal, 30 dias depois de gerar (`validadePadraoDoCard`). Sem limite de tamanho.
- **Serviços:** `src/lib/services/drive-card.ts` (`lerCard`, `projetoDoCard` com a regra da ficha, `destinosDoProjeto`, `tituloDoCard`, `freelaDoCard`, `registrarEnvioNoCard`) e, em `drive-links.ts`, `linkDoCard(cardId, { userId, criar? })`, `trocarDestinoDoCard(linkId, chave)`, `textoWhatsAppCard`. `trocarLink` copia card e destino. `revogarLinksDe({ projectId })` também pega o link do card.
- **Destino:** a chave (`Master` | `Redes` | `Legendas` | `render`) vira a pasta pela estrutura do projeto no banco (`drive_projetos`, conta atual). Nenhum id de pasta vem do navegador: o `Destino` `{ tipo: "card", pessoa }` não tem pasta (zod `.strict()`), e o lote cai em `link.destinoPastaId`.
- **Painel (aba Peça → Onde subir → "Link para o freela", `quadro/link-card.tsx` + `link-card-actions.ts`):** só aparece com projeto e pasta. Escolhe o destino (padrão: a seção marcada nos chips), gera; depois mostra destino e validade, **Copiar link**, **Mandar no WhatsApp** (freela responsável com telefone), **Trocar destino** (mesmo token), **Validade**, **Trocar link** e **Desativar**. O estado vem sob demanda por Server Action (não entra no `cfg`); um cache por card serve também o **Mandar para o freela**, que acrescenta "*Para subir a peça final* (vai para …) <link>" quando há link ativo.
- **WhatsApp do link (3 variações):**
  1. **"Olá, Rafael. Link para subir a peça final de “SERHS · Reels · Verão”: <url>. Vai direto para 06 Entregas / Redes, com o nome original do arquivo."** (escolhida: diz o quê, onde cai e que o nome fica)
  2. "Rafael, a versão final de “SERHS · Reels · Verão” sobe por aqui: <url>"
  3. "Peça final de “SERHS · Reels · Verão”: <url>. Os arquivos caem direto na pasta da ZRO."
- **Página pública** `/enviar/<token>` (mesmo endereço da diária; `abrirLinkPublico` aceita os dois tipos; a rota `/enviar/<token>/api` usa `rotaEnvioPublica(["freela-diaria", "freela-card"])`): rótulo "ENVIO DA PEÇA FINAL", título **"Da edição para a ZRO."** (variações: "A peça final, direto na pasta.", "Peça final."), subtítulo cliente · projeto · formato, bloco "O card" com o tema e "Vai para 06 Entregas / Redes.". "01 · Quem envia": o responsável já marcado ("Rafael M.", nunca o nome inteiro) ou "Outra pessoa" com o nome. "02 · Os arquivos": arquivos (principal) ou pasta (entra com a estrutura), sem rolo, sem pergunta de cartão, nome original. Concluído: **"Peça recebida."** (variações: "Chegou na ZRO.", "Na pasta certa."). Expirado, desativado e indisponível: as telas da diária. Card na lixeira: indisponível.
- **Servidor:** `abrirLote` com link `freela-card` → `abrirLoteDoCard`: link ativo, card vivo, pessoa = o freela responsável (`resp = "f:<id>"`) ou nome de 2 a 60 letras, pasta de destino viva no Drive. Mesma impressão = mesmo lote (retomada). Rótulo do lote: "06 Entregas / Redes · Rafael Moura". Histórico do projeto uma vez (`avisadoEm`): "Rafael Moura enviou a peça de “SERHS · Reels · Verão” para 06 Entregas / Redes: 2 arquivos, 1,2 GB.".

### "Enviar aqui" dentro do card (`quadro/envio-peca.tsx`)

- Tocar abre o seletor do aparelho (vários arquivos; no iPhone, Fotos ou Arquivos) e o envio acontece no próprio card: miniatura (imagem pelo arquivo, vídeo por um quadro gerado no navegador, o resto pelo ícone do tipo), nome, tamanho, barra, velocidade e tempo, Pausar/Continuar/Cancelar/Tentar de novo, aviso de rede caída e de sessão expirada.
- Um motor só para a Pauta (`criarMotor` com `transporteDaRota("/painel/arquivos/api")`, escopo `pauta`): fechar a ficha não para o envio e o card da lista mostra um chip com o andamento. Recarregar a página: o card avisa que um envio parou (`zro.pauta.envio.v1` guarda lote → card) e escolher os mesmos arquivos continua de onde parou.
- Protocolo: `Destino` `{ tipo: "pasta", pastaId, cardId? }`. Com `cardId`, o servidor só aceita uma pasta de destino do projeto do card (senão 400), grava `drive_lotes.card_id`, rótulo "06 Entregas / Master" e `pessoaNome` do sócio logado.

### No card, quando o lote fecha (`registrarEnvioNoCard`)

- Roda em todo `fecharLote` e na conciliação, para link e para "Enviar aqui". Sempre por `quadroMudar` (por campo, com histórico; `quem` = `link:<id>` ou o usuário), com `base` e até três voltas se alguém mexeu nos links ao mesmo tempo.
- Mensagem com chave fixa por lote `cm_env_<lote>`: "Rafael subiu 2 arquivos em 06 Entregas / Redes." (`por` = "Link de envio" ou `u:<id>` no painel). Só é regravada se o texto mudar (um "Tentar de novo" que completa o lote atualiza a contagem).
- `links` ganha `https://drive.google.com/file/d/<id>/view` (nome = nome do arquivo) de cada arquivo concluído, sem repetir o que já está lá (compara o id do Drive). Card na lixeira ou sumido: nada.

### Testes

`scripts/tests/drive-link-card.test.mts` (Google falso): criar, um ativo por card (índice), trocar destino, envio completo na pasta certa sem rolo, card com mensagem e links uma vez só (fechar duas vezes e conciliação), arquivo repetido não duplica, "Enviar aqui" do painel (pasta fora do card recusada, mensagem com o sócio), pessoa, formato (cartão/pasta no link do card e card no link da diária), IDOR (envio e lote de outro link), expirado e revogado, trocar link e card na lixeira.

### Pendências

- O lote do card aparece em Arquivos → "Chegou" como lote de freela ("06 Entregas / Redes · Rafael Moura"); a aba Drive do projeto ainda não tem um card próprio para ele.
- Prévia de vídeo depende do navegador decodificar o formato (MOV/ProRes no Chrome do computador costuma não abrir: fica o ícone).

---

## 16. Prévia: miniaturas, player e Baixar (painel e área do cliente)

### Para o Victor

- **Painel → Arquivos:** botão **Lista / Miniaturas** (cada aparelho lembra a escolha). Em Miniaturas, a grade mostra a miniatura do Google, a duração no vídeo e o ícone do tipo quando não há miniatura. Tocar num arquivo abre a **prévia**: janela grande no computador, tela cheia no celular; setas ou deslizar para o lado passam de arquivo; arrastar para baixo ou Esc fecham.
- **Vídeo e áudio** tocam no player da ZRO (preto e branco, pílulas): barra arrastável com o tempo, play/pausa, volume e mudo, velocidade (1x, 1,5x, 2x, 0,5x) e tela cheia. Tocam **em streaming, direto do Google**: nada é baixado inteiro antes e nenhum byte passa pela Vercel.
- **Foto:** grande, com zoom (pinça, toque duplo, duplo clique, roda do mouse). Primeiro a miniatura alta do Google; o JPG/PNG/WebP original entra por cima quando chega.
- **Bruto de câmera** (BRAW, R3D, ARRI, MXF; ProRes que o navegador recusa): se existir um `.mp4`/`.mov` com o mesmo nome na pasta ou numa subpasta `Proxy`/`Proxies`, toca o proxy com o selo **Proxy** e a frase "Prévia em baixa resolução. O Baixar traz o original." Sem proxy: miniatura grande e "Este formato não toca no navegador."
- **Vídeo pesado demais para a rede** (pedido do Victor depois do teste no iPhone): antes de tocar, a taxa é calculada (`tamanho × 8 ÷ duração`). Acima de **60 Mb/s no celular** ou **400 Mb/s no computador**, o original não toca: aparece a miniatura grande com "Vídeo pesado demais para tocar pela rede.", **Ver no Google Drive** (no iPhone abre o app do Drive, que toca a cópia leve dele) e **Tentar mesmo assim**. Se tocando ele travar (em espera por mais de 4 s, ou o tempo andando sem quadro novo), o player pausa e mostra o mesmo aviso. O proxy de câmera, quando existe, tem prioridade e toca.
- **Botões da prévia:** **Baixar** em destaque (no computador, o link do próprio Google; no celular, pelo stream, com aviso acima de 1 GB), **Abrir no Drive** e **Copiar link**.
- **Área do cliente:** as entregas viram uma grade de miniaturas por seção (Master, Redes, Legendas, Outros) com duração e botão de baixar. Tocar abre a mesma prévia, com o símbolo da ZRO no topo. O vídeo toca no player da ZRO direto do Google quando a **chave de API** opcional existe (DEPLOY.md, passo 5.6); sem a chave, com arquivo pesado demais ou travando, toca o **player do próprio Google Drive** embutido (a cópia leve dele). Se nem ele carregar, aviso com **Ver no Google Drive**.

### Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| **Vídeo no painel** | **Service worker com escopo `/painel/stream/`** (`/painel/stream/sw.js`). Ele pega um token de acesso curto em `/painel/arquivos/token` e repassa o pedido com `Range` para `files/<id>?alt=media&supportsAllDrives=true`, devolvendo em streaming (206). | `<video>` não manda `Authorization`. Os bytes vão do Google para o navegador: nada pela Vercel (custo e limite de tempo das funções). Mesmo desenho do SOBEDESCE, que já roda. |
| **Por que um quadro (`<iframe>`)** | O `<video>` mora num quadro em `/painel/stream/quadro` (mesma origem, sem script próprio); os controles ficam na página e mexem no elemento de lá. Fotos originais e o "por que não tocou" são lidos por um quadro escondido. Download: navegação para `/painel/stream/arquivo/<id>?baixar=1`. | Um service worker só atende as páginas **dentro** do escopo dele. Escopo `/painel/` deixaria o painel inteiro (a Pauta a cada 4 s, os envios de 250 GB em pedaços) passando por ele. Com o quadro, o SW fica restrito e nada mais muda. |
| **Sem service worker** | `/painel/stream/arquivo/<id>` existe também no servidor: com login, redireciona para o próprio Google (ver ou baixar). A prévia mostra "A prévia não abriu neste navegador." com o link do Drive. | Navegador sem SW (ou recarregar forçado) nunca cai numa página quebrada e nunca recebe bytes pela Vercel. |
| **Token do stream** | `GET /painel/arquivos/token`: login, cabeçalho `X-ZRO-Stream: 1`, `Sec-Fetch-Site` do mesmo site, `no-store`. Devolve só o token de acesso (≈1 h; o SW renova antes de 15 min) e a base da API. O SW aceita só `https://www.googleapis.com/drive/v3` (ou o Google falso em 127.0.0.1/localhost, só se o próprio painel estiver em localhost). | O refresh token nunca sai do servidor. Outro site não consegue ler a resposta (sem CORS) nem mandar o cabeçalho sem preflight. O token só vai para os navegadores logados do Victor e do Edu, e já dá o mesmo acesso que o painel inteiro dá. |
| **Miniatura** | Rota do servidor: `/painel/arquivos/miniatura/<id>?s=` (login) e `/cliente/<token>/miniatura/<id>?s=`. O servidor pede o `thumbnailLink` atual (`files.get`) e busca a imagem com o token (sem token, se o Google recusar). Tamanhos fixos 160/320/640/1280/2000. Só hosts do Google, redirecionamentos conferidos, só jpeg/png/webp/gif, até 8 MB, `CSP sandbox`, `nosniff`. Cache em memória 5 min (32 MB) e `Cache-Control: private` (300 s no painel, 120 s no cliente). | O `thumbnailLink` exige sessão do Google e dura horas. Miniatura é pequena (dezenas de KB): passar pelo servidor custa pouco e não expõe token. |
| **Vídeo no cliente** | (a) **chave de API** (`GOOGLE_API_KEY`, opcional): `files/<id>?alt=media&key=…` direto no `<video>` (Range, sem CORS, nenhum token da ZRO). (b) Sem chave, com `resourceKey`, pesado demais ou travando: o **player do Google Drive** em `<iframe>` (`/file/d/<id>/preview`). (c) Proxy pelo servidor: **não** usado. | (a) dá o player da ZRO e só lê o que tem "qualquer pessoa com o link" (06 Entregas liberada); Recolher corta na hora. (b) funciona sem configurar nada e usa a cópia leve do Google. (c) passaria GB pela Vercel. |
| **Referer do cliente** | `/cliente/*` passa de `no-referrer` para **`strict-origin`** e ganha `frame-src 'self' https://drive.google.com`. | A chave de API é restrita ao endereço do site e o Google confere o Referer. `strict-origin` manda só `https://zrofilmes.vercel.app/`, nunca o caminho com o código do link (o motivo do `no-referrer`). |
| **Pesado demais** | `pesadoDemais({tamanho, duracaoMs}, celular)` em `src/lib/drive/midia.ts`: 60 Mb/s no celular (largura < 768 px ou ponteiro grosso), 400 Mb/s no computador. Sem duração: tenta tocar (o vigia cobre). Vigia no player: `readyState < 3` por 4 s com o play pedido, ou `requestVideoFrameCallback` sem quadro novo por 4 s com o tempo andando. | A rede não entrega ~1 Gb/s em tempo real; o Drive toca porque usa uma cópia leve que a API não expõe. |
| **Proxy** | `GET /painel/arquivos/proxy/<id>`: o servidor busca por **nome exato** (`base.mp4/.MP4/.mov/.MOV/.m4v/.M4V`) na pasta do original e nas subpastas `Proxy`/`Proxies` dela. Cache de 5 min. | Nada de listar um cartão inteiro (milhares de arquivos). |
| **Lista / Miniaturas** | Cookie `zro_arquivos_vista` (`path=/painel`, 1 ano): o servidor já desenha a vista certa. | Sem piscar na abertura. |

### Arquivos

| Arquivo | O quê |
|---|---|
| `src/lib/drive/midia.ts` (puro) | tipo do arquivo, o que toca, proxy (nome-base), tamanhos de miniatura, duração, `taxaMbps`, `pesadoDemais`, links do Drive |
| `src/lib/drive/stream-sw.ts` | o código do service worker e a página do quadro |
| `src/lib/drive/navegador/stream.ts` | registro do SW, `urlDeStream`, quadro escondido, `porQueFalhou`, `baixarPeloStream` |
| `src/lib/drive/rota-previa.ts` | as rotas (miniatura do painel e do cliente, token, proxy, reserva sem SW) |
| `src/lib/services/drive-previa.ts` | `miniatura` (cache), `acessoParaStream`, `acharProxy`, `entregaDaArea`, `urlPublicaDeMidia` |
| `src/lib/auth/requisicao.ts` | `usuarioDaRequisicao` (a sessão lida do cookie da requisição, para route handlers) |
| `src/lib/google/drive.ts` | `ItemDrive.midia` e `chaveRecurso`; `buscarItens`, `itemComMidia`, `linkDaMiniatura`, `baixarMiniatura` |
| `src/lib/google/config.ts` | `miniaturaPermitida`, `chaveApiGoogle` |
| `src/lib/google/conexao.ts` | `acessoCurto` |
| `src/components/previa/` | `player.tsx` (player da ZRO, com quadro opcional e vigia), `previa.tsx` (janela, gestos, foto com zoom, avisos), `miniatura.tsx` |
| `src/app/(painel)/painel/arquivos/` | `navegador.tsx` (Lista/Miniaturas, abre a prévia), `previa-painel.tsx`, `vista.ts`, rotas `miniatura/[id]`, `token`, `proxy/[id]` |
| `src/app/(painel)/painel/stream/` | `sw.js`, `quadro`, `arquivo/[id]` (reserva) |
| `src/app/cliente/[token]/` | `entregas.tsx` (servidor), `entregas-grade.tsx` (grade e prévia), rota `miniatura/[id]` |

### Segurança e LGPD

- O cliente **nunca** recebe token da conta Google da ZRO. Na página dele só vão: a miniatura pela rota do servidor e, com a chave, o endereço `alt=media&key=` de arquivos que já são "qualquer pessoa com o link".
- Miniatura do cliente, nesta ordem: prévia da Vercel → 404; limite por IP; link do tipo `cliente-area`, **ativo** (não expirado, não revogado); senha (cookie da área); o arquivo está em **06 Entregas** de um projeto **deste cliente**, não cancelado, com `entregasLiberadasEm`, na conta atual (a lista vem dos ids do banco, `entregasDoProjeto`). Qualquer recusa: 404 (não diz se existe).
- Painel: login em toda rota (o `src/proxy.ts` continua como estava); ids pelo formato (`idDriveValido`, nunca `root`); o Google decide o que a conta enxerga.
- O SW só atende `GET /painel/stream/arquivo/<id>` com id no formato do Drive; nada é guardado (`no-store`); o token fica só na memória dele.
- Nada é apagado: a prévia só lê.

### Testes

- `scripts/tests/drive-previa.test.mts` (Google falso, Postgres em memória): pura (tipos, proxy, tamanhos, taxa); miniatura do painel (sem login, sessão de senha antiga, tamanho arredondado, cache sem ir ao Google, sem miniatura/lixeira/id inválido); token (cabeçalho, sessão, mesmo site, sem refresh token, `Range` 206 no Google); proxy (mesma pasta, subpasta `Proxy`, não achado, sem login); cliente (sem liberar, liberado, 05 Render recusado, outro cliente recusado, senha, expirado, Recolher corta miniatura e chave, revogado; dados de mídia e chave com Range; `resourceKey` sem endereço direto); reserva sem SW; Google desconectado.
- `scripts/drive-e2e-previa.mjs` (Playwright + Google falso com chave de API e Referer conferido; mídia VP9/Opus gerada com ffmpeg, porque o Chromium do Playwright não toca H.264): grade, vídeo tocando pelo SW (tempo avança, `rangeGets` no Google, 206 do SW com `Content-Range` refeito), foto original, R3D sem proxy, BRAW com proxy, ProRes 1,2 GB/10 s (pesado), vigia com o Google a 20 KB/s, áudio, lista, 390 px; área do cliente em 1440 e 390 (miniaturas, filme tocando pela chave, pesado no player do Drive, foto), miniatura de 01 Cenas recusada, cabeçalhos de `/cliente`. Apaga os dados de teste no fim.
- O Google falso (`scripts/google-mock/`) ganhou: `setMedia` (miniatura com `thumbnailLink` que exige token, `videoMediaMetadata`, `imageMediaMetadata`), chave de API (`chavesApi`, `chaveApiReferer`) só para arquivo com link público, CORS na API de arquivos (sem expor `Content-Range`, o pior caso) e, no controle, `POST /adicionar` e `POST /midia`.

### Pendências

1. **Conferir com a conta real** (depois do deploy): miniatura pelo servidor (o `thumbnailLink` aceitar o token), vídeo do painel no Chrome, Safari do Mac e iPhone (SW em quadro), download pelo stream no iPhone, e a chave de API com o Referer `strict-origin`.
2. **Criar a chave de API** (DEPLOY.md, passo 5.6). Sem ela tudo funciona, só que o cliente assiste no player do Google Drive.
3. **Limites de taxa** (60 e 400 Mb/s) são estimativas: ajustar depois de usar com material de verdade.
4. **"Baixar tudo"** não existe na área do cliente (não havia antes). Dá para acrescentar um botão para a pasta 06 Entregas no Google Drive (o próprio Google baixa tudo em .zip).
5. **Prévia na Pauta** (card) continua com a regra antiga (§15): pode usar este player depois.
6. O player do Google Drive embutido não tem como avisar que falhou (é de outro domínio): depois de 15 s sem carregar, cai no aviso com o botão.

---

## Anexo: onde cada ponto da revisão adversarial foi resolvido

| Ponto | Onde |
|---|---|
| P0-1 404/410 voltava para a sessão morta | 5 (`iniciar` passo 5: nunca devolve sessão sem consultar), 6 (404 → `conferir` → `iniciar`) |
| P0-2 308 sem `Range` virava zero | 6 (tabela: desconhecido → servidor; `rangeVisivel` por aparelho), 9 (linha nova no portão) |
| P0-3 arquivo no Drive marcado "expirado" | 5 (`conferir` e `conciliarParados` buscam por `appProperties`), 13.4 (mock guarda `appProperties`) |
| P0-4 cookie de 12 h cortava envio longo | 5 (`conferir`/`cancelar`/`fecharLote` sem cookie; cookie deslizante de 30 dias), 6 (`precisaEntrar` sem perder a fila) |
| P0-5 escopo por substring | 1, 9 (igualdade exata) |
| P0-6 bloqueio pelo tamanho declarado | 5 (Limites: sem pré-checagem; bytes ativos só nas últimas 2 h; limites por link) |
| P0-7 `concluir` duplo | 5 (`UPDATE … WHERE estado='enviando' RETURNING`; `avisadoEm`) |
| P0-8 três branches | cabeçalho e 12 (uma branch, três blocos sem arquivo em comum) |
| P0-9 verificação fraca | 13.2 (typecheck completo, grep geral da migração), 13.5 (build e banco do zero em cópia) |
| P1-10 bidi | 4 (`limparControles`), 13.3 |
| P1-11 MIME `vnd.google-apps` | 4 (`tipoSeguro`; sem `mimeType` nos metadados) |
| P1-12 ids sem validação, URI sem conferência | 4 (`idDriveValido`, `idDePastaDoLink`, `sessaoPermitida`) |
| P1-13 metadados na sessão | 4 (`fields=id`) |
| P1-14 URI no `localStorage` | 6 (`retomar.ts` guarda só lotes) |
| P1-15 retomada no iPhone | 5 (casamento sem `modificado`), 6 |
| P1-16 IP em `login_attempts` | 5 (`ip: null`) |
| P1-17 falta de chave derrubava páginas | 4 (`cripto.ts`, `googleConfigurado`) |
| P1-18 backup sem `tokenHash` | 3 (Backup) |
| P1-19 desativar não parava envios | 7.2/7.4 ("Cancelar os envios em andamento"), 9 (Desconectar avisa) |
| P1-20 troca de conta | 4 (`conta` nas tabelas, `geracao`), 9 (`outra_conta` e `?trocar=1`) |
| P1-21 `estado`/`cancelar` | 5 (`conferir` único; `cancelar` conclui se já terminou) |
| P1-22 relay confiando no `inicio` | 5 (Relay: só interface, regras escritas) |
| P1-23 três árvores de pastas | 0 e 4 (uma estrutura só, texto igual em toda tela) |
| P1-24 conta e espaço | 0 e 1 (Workspace, contato@dissesim.com.br), 4 (`canAddChildren`) |
| P1-25 limites baixos | 5 (6.000/10 min por IP, 10.000 arquivos/h por link, `iniciar` em lotes de 50) |
| P1-26 estados que faltavam | 6 (pastas por arrastar), 7.1, 8.2, 8.3 |
| P1-27 ícone do histórico | 7.5 |
| P1-28 mesmo projeto do SOBEDESCE | 0 e 1 (projeto "ZRO Site"), 11 |
| P1-29 prazo de retenção | 8.4 (fórmula atual mantida) |
| P2-30 relay | 1 e 5 (só interface) |
| P2-31 teste empírico | 9 (o próprio motor, 5 linhas) |
| P2-32 navegador de pastas | **Mantido**: o Victor quer subir e baixar pelo site (7.1) |
| P2-33 aviso por consulta periódica | cortado (nada em `layout.tsx`) |
| P2-34 `pv`, armadilha, `sePrevia` no painel | `senhaVersao` fica (existe troca de senha); armadilha cortada; guarda de prévia só fora de `/painel` |
| P2-35 `maximumScale` | 8.1 (não usar; campos de 16 px) |
| P2-36 `beforeunload` no iOS | 6 (`pagehide` + retomada) |
| P2-37 `ZRO_GOOGLE_API_BASE` | 4 (exige fora da Vercel e fora de produção) |
| P2-38 "Oi!" | 7.2/7.4 (textos sem exclamação) |

---

## Registro (verificação, 2026-10-16, Google falso)

- **Estático:** `npm run typecheck` e `npm run lint` limpos; `npm run build` limpo numa cópia isolada com `db:reset` (0000 → 0008, semeadura e "Apagar dados de exemplo" com as tabelas novas: exemplos somem, link que apontava para exemplo fica revogado e com o vínculo nulo). Migração 0008: só `CREATE` e `ALTER TABLE "drive_…" ADD CONSTRAINT`.
- **Testes puros e de serviço:** 62 de 62 (`scripts/tests/drive-*.test.mts`).
- **E2E do protocolo** (`scripts/drive-e2e-protocolo.mjs`): 20 de 20.
- **E2E das telas** (`scripts/drive-e2e-telas.mjs`, 1440 e 390): 21 de 21. Árvore com os nomes exatos; "Criar pastas" em projeto antigo; Arquivos (arquivos, pasta, 0 byte, Baixar = `webContentLink`, Nova pasta); link da diária na aba Drive e na agenda; cartão com subpastas (estrutura preservada, sem o nome do cartão e sem `.DS_Store`) → A001, A002, mesmo cartão → pergunta, Drone → D001; quedas de conexão (`dropUploadProb 0.9`) e recarga no meio (mesmo rolo, 1 sessão, menos de 1,6× os bytes); MD5 igual no Google falso em todos os arquivos; Liberar entregas (permissão só em 06 Entregas, e-mail do Google contado); área com senha (errada, certa, 6 erros → bloqueio, senha trocada no meio do envio → janela e continua); cliente só vê 06 Entregas, projeto de outro cliente → 404; envio para `03 Assets/Do cliente/<data> · <assunto>`; sessão do painel expirada no meio → Entrar e Continuar; links desativado, expirado e indisponível; backup com as 8 tabelas e nenhum segredo (`tokenHash` presente).
- **Falta:** o teste com a conta real (seção 13.8) e o diagnóstico por aparelho (Chrome, Safari do iPhone, app da tela inicial).

### Prévia (§16), 2026-10-16, Google falso

- `npm run typecheck`, `npm run lint` e `next build` (cópia isolada) limpos.
- Testes: 95 de 95 em `scripts/tests/drive-*.test.mts` (inclui os 20 novos de `drive-previa.test.mts`).
- E2E `scripts/drive-e2e-previa.mjs`: 14 de 14, em 1440 e 390. Vídeo pelo SW: tempo 2,7 → 4,2 s, pedidos com `Range` no Google, SW respondendo 206 `bytes 100-1099/<total>`. Cliente: filme pela chave de API (o Referer passou na restrição do Google falso).
- **Falta:** a conta real (pendência 1 do §16).
