CREATE TABLE "quadro_cards" (
	"org" text NOT NULL,
	"id" text NOT NULL,
	"dados" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"versoes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quadro_cards_org_id_pk" PRIMARY KEY("org","id")
);
--> statement-breakpoint
CREATE TABLE "quadro_historico" (
	"n" bigserial PRIMARY KEY NOT NULL,
	"org" text NOT NULL,
	"card_id" text NOT NULL,
	"quando" timestamp with time zone DEFAULT now() NOT NULL,
	"quem" text,
	"operacao" text NOT NULL,
	"campos" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "quadro_cards_atualizado_idx" ON "quadro_cards" USING btree ("org","atualizado_em");--> statement-breakpoint
CREATE INDEX "quadro_historico_card_idx" ON "quadro_historico" USING btree ("org","card_id","quando");--> statement-breakpoint
ALTER TABLE "quadro_cards" ADD CONSTRAINT "quadro_cards_id_ok" CHECK ("id" ~ '^[A-Za-z0-9_-]{4,64}$');
