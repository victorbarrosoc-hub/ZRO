CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`mime` text NOT NULL,
	`data` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `logo_id` text REFERENCES images(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `freelancers` ADD `photo_id` text REFERENCES images(id) ON DELETE set null;