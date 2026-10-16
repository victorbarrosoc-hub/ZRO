CREATE TABLE "drive_compartilhamentos" (
	"id" text PRIMARY KEY NOT NULL,
	"motivo" text NOT NULL,
	"arquivo_id" text NOT NULL,
	"permissao_id" text,
	"tipo" text NOT NULL,
	"papel" text NOT NULL,
	"email" text,
	"avisou_por_email" boolean DEFAULT false NOT NULL,
	"project_id" text,
	"client_id" text,
	"drive_projeto_id" text,
	"erro" text,
	"criado_por_id" text,
	"criado_em" timestamp with time zone NOT NULL,
	"revogado_em" timestamp with time zone,
	"revogado_por_id" text
);
--> statement-breakpoint
CREATE TABLE "drive_conexao" (
	"id" text PRIMARY KEY NOT NULL,
	"conta" text,
	"conta_nome" text,
	"escopo" text,
	"refresh_token_enc" text,
	"geracao" integer DEFAULT 1 NOT NULL,
	"raiz_nome" text DEFAULT 'ZRO' NOT NULL,
	"raiz_id" text,
	"clientes_id" text,
	"conectado_por_id" text,
	"conectado_em" timestamp with time zone,
	"desconectado_em" timestamp with time zone,
	"erro" text,
	"erro_em" timestamp with time zone,
	"diagnosticos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"atualizado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_diarias" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text,
	"project_id" text,
	"drive_projeto_id" text,
	"numero" integer NOT NULL,
	"data" text NOT NULL,
	"nome" text NOT NULL,
	"cenas_pasta_id" text,
	"audios_pasta_id" text,
	"criado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_envios" (
	"id" text PRIMARY KEY NOT NULL,
	"lote_id" text,
	"pasta_id" text NOT NULL,
	"caminho_relativo" text DEFAULT '' NOT NULL,
	"nome" text NOT NULL,
	"nome_original" text,
	"tipo" text NOT NULL,
	"tamanho" bigint NOT NULL,
	"modificado" bigint,
	"estado" text DEFAULT 'enviando' NOT NULL,
	"sessao_enc" text,
	"sessao_expira_em" timestamp with time zone,
	"sessao_host" text,
	"arquivo_id" text,
	"md5" text,
	"erro" text,
	"ultimo_sinal_em" timestamp with time zone,
	"concluido_em" timestamp with time zone,
	"criado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_links" (
	"id" text PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_enc" text,
	"senha_hash" text,
	"senha_versao" integer DEFAULT 0 NOT NULL,
	"event_id" text,
	"diaria_id" text,
	"project_id" text,
	"client_id" text,
	"rotulo" text NOT NULL,
	"expira_em" timestamp with time zone,
	"limite_bytes" bigint,
	"revogado_em" timestamp with time zone,
	"revogado_por_id" text,
	"criado_por_id" text,
	"ultimo_uso_em" timestamp with time zone,
	"criado_em" timestamp with time zone NOT NULL,
	"atualizado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_lotes" (
	"id" text PRIMARY KEY NOT NULL,
	"origem" text NOT NULL,
	"link_id" text,
	"user_id" text,
	"project_id" text,
	"client_id" text,
	"event_id" text,
	"diaria_id" text,
	"drive_projeto_id" text,
	"freelancer_id" text,
	"pessoa_nome" text,
	"fonte" text,
	"gravador" text,
	"rolo" text,
	"rotulo" text NOT NULL,
	"assunto" text,
	"cartao_nome" text,
	"impressao" text,
	"pasta_id" text NOT NULL,
	"caminho" text NOT NULL,
	"arquivos_previstos" integer DEFAULT 0 NOT NULL,
	"bytes_previstos" bigint DEFAULT 0 NOT NULL,
	"arquivos_recebidos" integer DEFAULT 0 NOT NULL,
	"bytes_recebidos" bigint DEFAULT 0 NOT NULL,
	"estado" text DEFAULT 'aberto' NOT NULL,
	"consentimento_em" timestamp with time zone,
	"avisado_em" timestamp with time zone,
	"visto_em" timestamp with time zone,
	"ultimo_sinal_em" timestamp with time zone,
	"concluido_em" timestamp with time zone,
	"criado_em" timestamp with time zone NOT NULL,
	"atualizado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_pastas" (
	"id" text PRIMARY KEY NOT NULL,
	"conta" text NOT NULL,
	"pai_id" text NOT NULL,
	"nome" text NOT NULL,
	"pasta_id" text,
	"chave" text,
	"criando_desde" timestamp with time zone,
	"criado_em" timestamp with time zone NOT NULL,
	"atualizado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drive_projetos" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"client_id" text,
	"conta" text NOT NULL,
	"rotulo" text NOT NULL,
	"caminho" text,
	"de_link" boolean DEFAULT false NOT NULL,
	"pasta_id" text,
	"pasta_url" text,
	"documentos_id" text,
	"cenas_id" text,
	"audios_id" text,
	"assets_id" text,
	"projeto_edicao_id" text,
	"render_id" text,
	"entregas_id" text,
	"subpastas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"estado" text DEFAULT 'criando' NOT NULL,
	"erro" text,
	"rolos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"entregas_liberadas_em" timestamp with time zone,
	"entregas_liberadas_por_id" text,
	"criado_em" timestamp with time zone NOT NULL,
	"atualizado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drive_compartilhamentos" ADD CONSTRAINT "drive_compartilhamentos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_compartilhamentos" ADD CONSTRAINT "drive_compartilhamentos_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_compartilhamentos" ADD CONSTRAINT "drive_compartilhamentos_drive_projeto_id_drive_projetos_id_fk" FOREIGN KEY ("drive_projeto_id") REFERENCES "public"."drive_projetos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_compartilhamentos" ADD CONSTRAINT "drive_compartilhamentos_criado_por_id_users_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_compartilhamentos" ADD CONSTRAINT "drive_compartilhamentos_revogado_por_id_users_id_fk" FOREIGN KEY ("revogado_por_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_conexao" ADD CONSTRAINT "drive_conexao_conectado_por_id_users_id_fk" FOREIGN KEY ("conectado_por_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_diarias" ADD CONSTRAINT "drive_diarias_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_diarias" ADD CONSTRAINT "drive_diarias_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_diarias" ADD CONSTRAINT "drive_diarias_drive_projeto_id_drive_projetos_id_fk" FOREIGN KEY ("drive_projeto_id") REFERENCES "public"."drive_projetos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_envios" ADD CONSTRAINT "drive_envios_lote_id_drive_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."drive_lotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_links_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_links_diaria_id_drive_diarias_id_fk" FOREIGN KEY ("diaria_id") REFERENCES "public"."drive_diarias"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_links_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_links_revogado_por_id_users_id_fk" FOREIGN KEY ("revogado_por_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_links" ADD CONSTRAINT "drive_links_criado_por_id_users_id_fk" FOREIGN KEY ("criado_por_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_lotes" ADD CONSTRAINT "drive_lotes_link_id_drive_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."drive_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_lotes" ADD CONSTRAINT "drive_lotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_lotes" ADD CONSTRAINT "drive_lotes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_lotes" ADD CONSTRAINT "drive_lotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_lotes" ADD CONSTRAINT "drive_lotes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_lotes" ADD CONSTRAINT "drive_lotes_diaria_id_drive_diarias_id_fk" FOREIGN KEY ("diaria_id") REFERENCES "public"."drive_diarias"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_lotes" ADD CONSTRAINT "drive_lotes_drive_projeto_id_drive_projetos_id_fk" FOREIGN KEY ("drive_projeto_id") REFERENCES "public"."drive_projetos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_lotes" ADD CONSTRAINT "drive_lotes_freelancer_id_freelancers_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."freelancers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_projetos" ADD CONSTRAINT "drive_projetos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_projetos" ADD CONSTRAINT "drive_projetos_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_projetos" ADD CONSTRAINT "drive_projetos_entregas_liberadas_por_id_users_id_fk" FOREIGN KEY ("entregas_liberadas_por_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drive_compart_projeto_idx" ON "drive_compartilhamentos" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "drive_compart_arquivo_idx" ON "drive_compartilhamentos" USING btree ("arquivo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "drive_diarias_evento_idx" ON "drive_diarias" USING btree ("event_id","drive_projeto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "drive_diarias_numero_idx" ON "drive_diarias" USING btree ("drive_projeto_id","numero");--> statement-breakpoint
CREATE INDEX "drive_envios_lote_idx" ON "drive_envios" USING btree ("lote_id","estado");--> statement-breakpoint
CREATE INDEX "drive_envios_pasta_nome_idx" ON "drive_envios" USING btree ("pasta_id","nome");--> statement-breakpoint
CREATE INDEX "drive_envios_ativos_idx" ON "drive_envios" USING btree ("ultimo_sinal_em") WHERE "drive_envios"."estado" = 'enviando';--> statement-breakpoint
CREATE UNIQUE INDEX "drive_links_token_idx" ON "drive_links" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "drive_links_diaria_ativa_idx" ON "drive_links" USING btree ("event_id") WHERE "drive_links"."revogado_em" is null and "drive_links"."tipo" = 'freela-diaria';--> statement-breakpoint
CREATE UNIQUE INDEX "drive_links_area_ativa_idx" ON "drive_links" USING btree ("client_id") WHERE "drive_links"."revogado_em" is null and "drive_links"."tipo" = 'cliente-area';--> statement-breakpoint
CREATE INDEX "drive_links_projeto_idx" ON "drive_links" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "drive_lotes_criado_idx" ON "drive_lotes" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "drive_lotes_projeto_idx" ON "drive_lotes" USING btree ("project_id","criado_em");--> statement-breakpoint
CREATE INDEX "drive_lotes_link_idx" ON "drive_lotes" USING btree ("link_id","criado_em");--> statement-breakpoint
CREATE INDEX "drive_lotes_cliente_idx" ON "drive_lotes" USING btree ("client_id","criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "drive_pastas_pai_nome_idx" ON "drive_pastas" USING btree ("conta","pai_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "drive_pastas_chave_idx" ON "drive_pastas" USING btree ("conta","chave");--> statement-breakpoint
CREATE INDEX "drive_pastas_pasta_idx" ON "drive_pastas" USING btree ("pasta_id");--> statement-breakpoint
CREATE UNIQUE INDEX "drive_projetos_projeto_idx" ON "drive_projetos" USING btree ("project_id","conta");--> statement-breakpoint
CREATE INDEX "drive_projetos_cliente_idx" ON "drive_projetos" USING btree ("client_id");