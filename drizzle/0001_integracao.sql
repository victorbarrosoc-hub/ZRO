ALTER TABLE `finance_entries` ADD `event_id` text REFERENCES events(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `project_crew` ADD `daily_rate` integer;--> statement-breakpoint
ALTER TABLE `project_crew` ADD `source` text DEFAULT 'manual' NOT NULL;