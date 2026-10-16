ALTER TABLE "drive_links" ADD COLUMN "card_id" text;--> statement-breakpoint
ALTER TABLE "drive_links" ADD COLUMN "destino_pasta_id" text;--> statement-breakpoint
ALTER TABLE "drive_links" ADD COLUMN "destino_rotulo" text;--> statement-breakpoint
ALTER TABLE "drive_lotes" ADD COLUMN "card_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "drive_links_card_ativo_idx" ON "drive_links" USING btree ("card_id") WHERE "drive_links"."revogado_em" is null and "drive_links"."tipo" = 'freela-card';