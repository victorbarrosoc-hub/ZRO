CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text,
	`client_id` text,
	`project_id` text,
	`type` text DEFAULT 'nota' NOT NULL,
	`content` text NOT NULL,
	`author_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activities_lead_idx` ON `activities` (`lead_id`);--> statement-breakpoint
CREATE INDEX `activities_project_idx` ON `activities` (`project_id`);--> statement-breakpoint
CREATE TABLE `call_sheets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`event_id` text,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`call_time` text,
	`location` text,
	`location_url` text,
	`schedule` text DEFAULT '[]' NOT NULL,
	`crew` text DEFAULT '[]' NOT NULL,
	`contacts` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `call_sheets_project_idx` ON `call_sheets` (`project_id`);--> statement-breakpoint
CREATE TABLE `catalog_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`group` text DEFAULT 'extra' NOT NULL,
	`unit` text DEFAULT 'unidade' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`cost` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`segment` text,
	`city` text,
	`document` text,
	`contact_name` text,
	`email` text,
	`phone` text,
	`instagram` text,
	`source` text DEFAULT 'outro' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `clients_name_idx` ON `clients` (`name`);--> statement-breakpoint
CREATE TABLE `equipment_kits` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`items` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_crew` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`freelancer_id` text NOT NULL,
	`function` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`freelancer_id`) REFERENCES `freelancers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_crew_event_idx` ON `event_crew` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `event_crew_unique_idx` ON `event_crew` (`event_id`,`freelancer_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`type` text DEFAULT 'diaria' NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`end_date` text,
	`start_time` text,
	`end_time` text,
	`location` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_date_idx` ON `events` (`date`);--> statement-breakpoint
CREATE TABLE `faqs` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `films` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`client` text,
	`category` text NOT NULL,
	`year` integer,
	`duration` text,
	`format` text DEFAULT '16:9' NOT NULL,
	`video_url` text,
	`poster_url` text,
	`preview_url` text,
	`summary` text,
	`intention` text,
	`credits` text,
	`stills` text,
	`featured` integer DEFAULT false NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `films_slug_idx` ON `films` (`slug`);--> statement-breakpoint
CREATE TABLE `finance_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`project_id` text,
	`client_id` text,
	`freelancer_id` text,
	`crew_id` text,
	`quote_id` text,
	`amount` integer NOT NULL,
	`paid_amount` integer DEFAULT 0 NOT NULL,
	`due_date` text NOT NULL,
	`paid_at` text,
	`competence` text,
	`installment` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`freelancer_id`) REFERENCES `freelancers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`crew_id`) REFERENCES `project_crew`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `finance_due_idx` ON `finance_entries` (`due_date`);--> statement-breakpoint
CREATE INDEX `finance_project_idx` ON `finance_entries` (`project_id`);--> statement-breakpoint
CREATE INDEX `finance_kind_idx` ON `finance_entries` (`kind`);--> statement-breakpoint
CREATE TABLE `finance_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`method` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `finance_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `finance_payments_entry_idx` ON `finance_payments` (`entry_id`);--> statement-breakpoint
CREATE TABLE `freelancer_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`freelancer_id` text NOT NULL,
	`function` text NOT NULL,
	`category` text,
	`amount` integer NOT NULL,
	`unit` text DEFAULT 'diaria' NOT NULL,
	FOREIGN KEY (`freelancer_id`) REFERENCES `freelancers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `freelancer_rates_freelancer_idx` ON `freelancer_rates` (`freelancer_id`);--> statement-breakpoint
CREATE TABLE `freelancers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`phone` text,
	`email` text,
	`instagram` text,
	`pix_key` text,
	`functions` text DEFAULT '[]' NOT NULL,
	`equipment` text,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `freelancers_name_idx` ON `freelancers` (`name`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text,
	`name` text NOT NULL,
	`company` text,
	`segment` text,
	`email` text,
	`phone` text,
	`project_type` text,
	`idea` text,
	`timing` text,
	`city` text,
	`days` text,
	`videos` text,
	`format` text,
	`extras` text,
	`budget` text,
	`stage` text DEFAULT 'novo' NOT NULL,
	`lost_reason` text,
	`source` text DEFAULT 'site' NOT NULL,
	`estimated_value` integer,
	`follow_up_at` text,
	`notes` text,
	`consent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `leads_stage_idx` ON `leads` (`stage`);--> statement-breakpoint
CREATE INDEX `leads_created_idx` ON `leads` (`created_at`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`ip` text,
	`success` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempts_email_idx` ON `login_attempts` (`email`,`created_at`);--> statement-breakpoint
CREATE TABLE `project_checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`date` text,
	`items` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checklists_project_idx` ON `project_checklists` (`project_id`);--> statement-breakpoint
CREATE TABLE `project_crew` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`freelancer_id` text,
	`name` text,
	`function` text NOT NULL,
	`work` text,
	`start_date` text,
	`due_date` text,
	`delivered_at` text,
	`amount` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`freelancer_id`) REFERENCES `freelancers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `crew_project_idx` ON `project_crew` (`project_id`);--> statement-breakpoint
CREATE INDEX `crew_freelancer_idx` ON `project_crew` (`freelancer_id`);--> statement-breakpoint
CREATE TABLE `project_deliverables` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`format` text,
	`duration` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'pendente' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`link` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `deliverables_project_idx` ON `project_deliverables` (`project_id`);--> statement-breakpoint
CREATE TABLE `project_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`stage` text NOT NULL,
	`title` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_project_idx` ON `project_tasks` (`project_id`);--> statement-breakpoint
CREATE TABLE `project_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`description` text,
	`tasks` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`client_id` text,
	`lead_id` text,
	`quote_id` text,
	`category` text DEFAULT 'filme-de-marca' NOT NULL,
	`stage` text DEFAULT 'origem' NOT NULL,
	`status` text DEFAULT 'ativo' NOT NULL,
	`start_date` text,
	`due_date` text,
	`value` integer DEFAULT 0 NOT NULL,
	`briefing` text,
	`creative_rule` text,
	`drive_url` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_code_idx` ON `projects` (`code`);--> statement-breakpoint
CREATE INDEX `projects_stage_idx` ON `projects` (`stage`);--> statement-breakpoint
CREATE TABLE `quote_items` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`catalog_item_id` text,
	`description` text NOT NULL,
	`detail` text,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit` text,
	`unit_price` integer DEFAULT 0 NOT NULL,
	`unit_cost` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`catalog_item_id`) REFERENCES `catalog_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `quote_items_quote_idx` ON `quote_items` (`quote_id`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`client_id` text,
	`lead_id` text,
	`project_id` text,
	`title` text NOT NULL,
	`category` text,
	`status` text DEFAULT 'rascunho' NOT NULL,
	`issue_date` text NOT NULL,
	`valid_until` text,
	`period` text,
	`scope` text,
	`payment_terms` text,
	`conditions` text,
	`discount` integer DEFAULT 0 NOT NULL,
	`tax_rate` real DEFAULT 0 NOT NULL,
	`internal_notes` text,
	`sent_at` integer,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_number_version_idx` ON `quotes` (`number`,`version`);--> statement-breakpoint
CREATE TABLE `scripts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text DEFAULT 'roteiro' NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`shots` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scripts_project_idx` ON `scripts` (`project_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `showcase_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`logo_url` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`quote` text,
	`photo_url` text,
	`instagram` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'socio' NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);