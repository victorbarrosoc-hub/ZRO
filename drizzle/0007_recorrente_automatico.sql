CREATE TABLE "recurring_runs" (
	"client_id" text NOT NULL,
	"month" text NOT NULL,
	"finance_at" timestamp with time zone,
	"finance_entry_id" text,
	"pauta_at" timestamp with time zone,
	"cards" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_runs_client_id_month_pk" PRIMARY KEY("client_id","month")
);
--> statement-breakpoint
ALTER TABLE "recurring_runs" ADD CONSTRAINT "recurring_runs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_runs" ADD CONSTRAINT "recurring_runs_finance_entry_id_finance_entries_id_fk" FOREIGN KEY ("finance_entry_id") REFERENCES "public"."finance_entries"("id") ON DELETE set null ON UPDATE no action;