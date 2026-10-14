-- =====================================================================
-- QUADRO — o banco (Supabase / Postgres)
-- Para quando a plataforma for guardar os cards num banco de verdade.
-- Rodar inteiro no SQL Editor do Supabase da plataforma. Não apaga nada:
-- só cria o que ainda não existe.
--
-- As regras que este arquivo garante (todas aprendidas na Maestro):
--   1. GRAVA POR CAMPO. Ninguém regrava o card inteiro: quem muda a legenda
--      não apaga o texto que outra pessoa acabou de escrever.
--   2. APAGAR É LÁPIDE. O card ganha "apagadoEm" e vai para a Lixeira; não
--      há DELETE. Restaurar é tirar a lápide.
--   3. HISTÓRICO DE TUDO. Cada gravação registra quem, quando e cada campo
--      de -> para. Nada se perde, e todo sumiço tem explicação.
--   4. CADA EQUIPE VÊ SÓ O SEU. Leitura por RLS (membros da organização);
--      escrita só pelas funções abaixo, que conferem a organização.
--   5. CONFLITO É POR CAMPO. Se o app manda a versão em que leu o card
--      (p_base) e outra pessoa mudou AQUELE campo depois disso, o banco
--      não sobrescreve: devolve o valor atual em "conflitos".
-- =====================================================================

-- quem é de qual organização (uma pessoa pode estar em mais de uma)
create table if not exists public.quadro_membros(
  org      text not null,
  user_id  uuid not null,
  papel    text not null default 'equipe',
  primary key (org, user_id)
);

-- os cards: tudo do card mora em "dados" (jsonb), um campo por chave
create table if not exists public.quadro_cards(
  org            text not null,
  id             text not null,
  dados          jsonb not null default '{}'::jsonb,
  versao         integer not null default 1,
  versoes        jsonb not null default '{}'::jsonb,   -- campo -> versão em que mudou por último
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  primary key (org, id),
  constraint quadro_cards_id_ok check (id ~ '^[A-Za-z0-9_-]{4,64}$')
);
create index if not exists quadro_cards_atualizado on public.quadro_cards(org, atualizado_em desc);

-- o histórico: cada gravação, com cada campo [antes, depois]
create table if not exists public.quadro_historico(
  n          bigserial primary key,
  org        text not null,
  card_id    text not null,
  quando     timestamptz not null default now(),
  quem       uuid,
  operacao   text not null,             -- criar | mudar
  campos     jsonb not null default '{}'::jsonb
);
create index if not exists quadro_historico_card on public.quadro_historico(org, card_id, quando desc);

-- ---------------------------------------------------------------------
-- leitura: cada um vê o que é da sua organização
-- escrita: só pelas funções (nenhuma política de insert/update/delete)
-- ---------------------------------------------------------------------
alter table public.quadro_membros   enable row level security;
alter table public.quadro_cards     enable row level security;
alter table public.quadro_historico enable row level security;

drop policy if exists quadro_membros_ler on public.quadro_membros;
create policy quadro_membros_ler on public.quadro_membros for select to authenticated
  using (user_id = auth.uid());
drop policy if exists quadro_cards_ler on public.quadro_cards;
create policy quadro_cards_ler on public.quadro_cards for select to authenticated
  using (org in (select m.org from public.quadro_membros m where m.user_id = auth.uid()));
drop policy if exists quadro_historico_ler on public.quadro_historico;
create policy quadro_historico_ler on public.quadro_historico for select to authenticated
  using (org in (select m.org from public.quadro_membros m where m.user_id = auth.uid()));

-- a organização vem SEMPRE explícita e é conferida (nunca "a primeira que achar")
create or replace function public.quadro_sou_membro(p_org text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.quadro_membros where org = p_org and user_id = auth.uid())
$$;

-- criar: o card inteiro, uma vez. Número repetido não sobrescreve ninguém.
create or replace function public.quadro_card_criar(p_org text, p_id text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d jsonb;
begin
  if not public.quadro_sou_membro(p_org) then return jsonb_build_object('ok', false, 'erro', 'sem_acesso'); end if;
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{4,64}$' then return jsonb_build_object('ok', false, 'erro', 'formato'); end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then return jsonb_build_object('ok', false, 'erro', 'formato'); end if;
  d := jsonb_strip_nulls(p_dados) || jsonb_build_object('id', p_id);
  insert into public.quadro_cards(org, id, dados, versao, versoes)
    values (p_org, p_id, d, 1, (select coalesce(jsonb_object_agg(k, 1), '{}'::jsonb) from jsonb_object_keys(d) k))
    on conflict (org, id) do nothing;
  if not found then return jsonb_build_object('ok', false, 'erro', 'id_existe'); end if;
  insert into public.quadro_historico(org, card_id, quem, operacao, campos)
    values (p_org, p_id, auth.uid(), 'criar',
      (select coalesce(jsonb_object_agg(k, jsonb_build_array(null, d -> k)), '{}'::jsonb) from jsonb_object_keys(d) k));
  return jsonb_build_object('ok', true, 'versao', 1);
end $$;

-- mudar: SÓ os campos enviados. Valor null = tirar o campo.
-- p_base (opcional): a versão em que o app leu o card. Campo que outra pessoa
-- mudou depois dela não é sobrescrito: volta em "conflitos" com o valor atual.
create or replace function public.quadro_card_mudar(p_org text, p_id text, p_campos jsonb, p_base integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.quadro_cards%rowtype;
  k text; v jsonb; antes jsonb;
  nova integer;
  v_dados jsonb; v_versoes jsonb;
  hist jsonb := '{}'::jsonb; conf jsonb := '{}'::jsonb;
begin
  if not public.quadro_sou_membro(p_org) then return jsonb_build_object('ok', false, 'erro', 'sem_acesso'); end if;
  if p_campos is null or jsonb_typeof(p_campos) <> 'object' then return jsonb_build_object('ok', false, 'erro', 'formato'); end if;
  select * into c from public.quadro_cards where org = p_org and id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'nao_existe'); end if;
  nova := c.versao + 1; v_dados := c.dados; v_versoes := c.versoes;
  for k, v in select * from jsonb_each(p_campos) loop
    if k = 'id' then continue; end if;
    antes := v_dados -> k;
    if antes is not distinct from (case when jsonb_typeof(v) = 'null' then null else v end) then continue; end if;
    if p_base is not null and coalesce((v_versoes ->> k)::int, 0) > p_base then
      conf := conf || jsonb_build_object(k, coalesce(antes, 'null'::jsonb));   -- mudou depois da leitura: fica o que está
      continue;
    end if;
    if jsonb_typeof(v) = 'null' then v_dados := v_dados - k; else v_dados := jsonb_set(v_dados, array[k], v, true); end if;
    v_versoes := jsonb_set(v_versoes, array[k], to_jsonb(nova), true);
    hist := hist || jsonb_build_object(k, jsonb_build_array(antes, case when jsonb_typeof(v) = 'null' then null else v end));
  end loop;
  if hist = '{}'::jsonb then return jsonb_build_object('ok', true, 'versao', c.versao, 'conflitos', conf); end if;
  update public.quadro_cards set dados = v_dados, versoes = v_versoes, versao = nova, atualizado_em = now()
    where org = p_org and id = p_id;
  insert into public.quadro_historico(org, card_id, quem, operacao, campos) values (p_org, p_id, auth.uid(), 'mudar', hist);
  return jsonb_build_object('ok', true, 'versao', nova, 'conflitos', conf);
end $$;

revoke all on function public.quadro_card_criar(text, text, jsonb) from public, anon;
revoke all on function public.quadro_card_mudar(text, text, jsonb, integer) from public, anon;
grant execute on function public.quadro_card_criar(text, text, jsonb) to authenticated;
grant execute on function public.quadro_card_mudar(text, text, jsonb, integer) to authenticated;
grant select on public.quadro_cards, public.quadro_historico, public.quadro_membros to authenticated;

-- ao vivo: quem está com o quadro aberto recebe a mudança na hora
do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'quadro_cards') then
    alter publication supabase_realtime add table public.quadro_cards;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Para pôr alguém na organização (rodar à mão, trocando o e-mail e a org):
--   insert into public.quadro_membros(org, user_id, papel)
--   select 'minha-org', id, 'admin' from auth.users where email = 'pessoa@exemplo.com'
--   on conflict do nothing;
-- ---------------------------------------------------------------------

