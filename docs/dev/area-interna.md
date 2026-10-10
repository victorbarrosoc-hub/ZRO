# Guia de desenvolvimento: área interna (/painel)

Como os módulos da área interna são construídos. Siga este padrão em tudo.
O módulo **Freelas** (`src/app/(painel)/painel/freelas/`) é a implementação de referência: leia antes de começar.

## Stack

- **Next.js 16** (App Router, Turbopack). Leia `node_modules/next/dist/docs/` quando tiver dúvida. Diferenças que importam:
  - `params` e `searchParams` são **Promises**: `const { id } = await params`.
  - Tipos globais: `PageProps<"/painel/freelas/[id]">`, `LayoutProps<...>`.
  - O antigo `middleware.ts` agora é `src/proxy.ts`.
- **Tailwind 4** com os tokens em `src/app/globals.css` (fonte: `docs/marca/tokens.md`).
- **Drizzle + Postgres** (Supabase em produção; PGlite local em `data/pglite`, servido pelo `npm run dev`). Schema em `src/lib/db/schema.ts`. Várias escritas que valem juntas: `transact((t) => [...])`. Busca de texto com `ilike`.
- **React 19**: `useActionState`, `useFormStatus`, Server Actions.

## Regras de dados

- **Dinheiro sempre em centavos (inteiro).** Entrada de formulário com `money(fd, "campo")` (usa `parseBRL`). Exibição com `brl()` / `brlCompact()`.
- **Datas de calendário em texto `AAAA-MM-DD`.** Hoje em Natal: `todayISO()`. Formatação: `dateBR`, `dateShort`, `dateLong`, `relativeDay`.
- Vocabulário (categorias, etapas, funções, status...) vem de `src/lib/domain.ts`. Não invente listas novas se já existir uma.
- Status de lançamento financeiro: `entryStatus(entry)` em `src/lib/format.ts`.
- Serviços compartilhados (use, não duplique):
  - `src/lib/services/finance.ts`: `registerPayment`, `deletePayment`, `recalcPaid`
  - `src/lib/services/projects.ts`: `nextProjectCode`, `createProject`, `applyTemplate`, `syncProjectReceivable` (valor do projeto → recebimento)
  - `src/lib/services/team.ts`: `syncProjectTeam` (diárias da agenda → equipe → pagamentos). Chame depois de mexer em equipe, diária ou escalação.
  - `src/lib/services/activity.ts`: `logProjectActivity` (o que acontece no projeto aparece no histórico do cliente)
  - `src/lib/services/clients.ts`: `ensureClientForLead`
  - `src/lib/settings.ts`: `getSetting("company" | "whatsapp" | "taxes" | "quote")`, `saveSetting`

## Estrutura de um módulo

```
src/app/(painel)/painel/<modulo>/
  page.tsx              lista (componente de servidor)
  [id]/page.tsx         detalhe (componente de servidor)
  actions.ts            "use server": todas as mutações do módulo
  <modulo>-dialogs.tsx  "use client": botões que abrem FormModal/ConfirmAction
  <modulo>-fields.tsx   "use client": campos reaproveitados em criar/editar
src/lib/queries/<modulo>.ts   leituras (import "server-only")
```

## Server Actions (padrão obrigatório)

```ts
"use server";
export async function criarAlgo(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();                       // SEMPRE primeiro: o proxy não basta
  const parsed = Schema.safeParse({ ... });  // zod, lendo com str()/money()/list()/bool()
  if (!parsed.success) return fromZod(parsed.error);
  await db.insert(...);
  revalidatePath("/painel/<modulo>");       // e todo caminho que mostra esse dado (inclusive /painel)
  return ok("Mensagem curta de sucesso.", id);
}
```

- Utilitários em `src/lib/actions.ts`: `ok`, `fail`, `fromZod`, `str`, `money`, `bool`, `list`.
- Excluir e redirecionar: `redirect()` depois do `revalidatePath`.
- Mensagens em português, diretas: "Freela cadastrado.", "Pagamento registrado.", "Digite o valor."

## Componentes

- `src/components/ui/`: `Button`, `ButtonLink`, `Input`, `Textarea`, `Select` (nativo), `MoneyInput`, `Field`, `Checkbox`, `Card`, `CardHeader`, `Badge`, `EmptyState`, `PageHeader`, `Divider`, `Modal`, `Menu`/`MenuItem`, `Tip`.
- `src/components/painel/form.tsx`: `FormModal` (janela com formulário; `children` pode ser função `(state) => campos` para erros por campo), `ActionForm`, `ConfirmAction`, `SubmitButton`, `fieldError`, `FormSection`.
- `src/components/painel/bits.tsx`: selos (`StageBadge`, `LeadStageBadge`, `ProjectStatusBadge`, `QuoteStatusBadge`, `EntryStatusBadge`, `DeliverableStatusBadge`), `Table`/`Th`/`Td`, `TabLinks` (abas via `?aba=`), `InfoList`, `whatsappHref`.
- `src/components/painel/stat.tsx`: `StatTile`, `HeroFigure` (um por tela).
- `src/components/painel/cashflow-chart.tsx`: gráfico de fluxo de caixa (regras da skill dataviz).
- `src/components/painel/search-field.tsx`: busca que atualiza `?q=`.
- `src/components/painel/avatar.tsx`: `Avatar` (foto do freela redonda, logo do cliente com `logo`; sem imagem, iniciais).
- `src/components/painel/image-field.tsx`: `ImageField` para formulário (reduz a imagem no navegador para 384 px e manda num campo escondido). No servidor: `readImageField` + `resolveImageField` + `deleteImages` (`src/lib/services/images.ts`). As imagens ficam na tabela `images` (base64, entram no backup) e abrem só logado em `/painel/imagem/[id]`.

**Páginas de servidor não passam funções para componentes cliente.** Formulários em janela ficam num arquivo `*-dialogs.tsx` ("use client") que importa as actions.

## Integração (não quebre)

- Escalar freela numa diária do projeto → entra na equipe com a diária do cadastro dele → pagamento a pagar no financeiro.
- Equipe "por diária": valor = diária × dias escalados. "Valor fechado": o valor digitado.
- Lançamento com baixa nunca é apagado nem reduzido abaixo do que já foi pago.
- Funções de freela: as padrão (`FUNCTIONS`) + as criadas no cadastro, cuja chave é o próprio nome. Liste com `functionOptions(...)` e normalize com `normalizeFunction`; `optionLabel(FUNCTIONS, chave)` já mostra o nome de uma função criada.
- Páginas sem texto explicativo: título, números e ações. Nada de `description` em `PageHeader`.

## Visual

- Preto e branco. Cor só como sinal de status (`ok`, `warn`, `danger`), sempre com texto junto.
- Superfícies: `Card` (gradiente sutil + `border-line`), raio 22–24px. Bordas de 1px.
- Títulos de página com `PageHeader`. Rótulo pequeno em mono caixa alta com a classe `label`.
- Números grandes com algarismos proporcionais; `tabular-nums` só em colunas de tabela.
- Tudo precisa funcionar no celular (390px): tabelas com rolagem horizontal, formulários em uma coluna, alvos de toque ≥ 40px.
- Gráficos novos seguem a skill **dataviz** (colunas ≤ 24px, legenda, tabela alternativa, dica no hover/foco, sem eixo duplo).
- Texto de interface: português do Brasil, direto e operacional (ver `docs/marca/voice.md`).

## Testar

- O servidor de desenvolvimento já roda em `http://localhost:3000`. **Não inicie outro e não derrube este.**
- Tipos: `npx tsc --noEmit` (filtre a saída pelos seus arquivos: outros módulos podem estar em obra ao mesmo tempo).
- Navegador logado: `scripts/lib/session.mjs` exporta `openLogged({ width, height })` → `{ browser, page, errors }`.
- Screenshot rápido: `node scripts/shot-auth.mjs /painel/rota saida.png 1440 900 --full`.
- Salve screenshots em `/tmp/claude-0/-home-user-ZRO/10e083cf-eb66-52f0-be31-ee55d05f2545/scratchpad/`.
- Dados de teste: crie com nome começando por "Teste" e apague depois. **Nunca rode `db:reset` ou `db:seed`** (o banco é compartilhado).

## Não faça

- Não altere `src/lib/db/schema.ts` nem as migrações. Precisando de campo novo, registre no relatório final.
- Não edite arquivos fora da sua área (componentes compartilhados, `domain.ts`, `format.ts`, outros módulos). Precisando, crie um utilitário local no seu módulo e sugira a mudança no relatório.
- Não rode comandos git que mudam estado (commit, stash, checkout, reset).
