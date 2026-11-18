CREATE TABLE `credentials` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`family_id` text NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`family_id` text NOT NULL,
	`event_id` text NOT NULL,
	`kind` text NOT NULL,
	`captured_at` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_event` ON `events` (`device_id`,`event_id`);--> statement-breakpoint
CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `families_owner_id_unique` ON `families` (`owner_id`);--> statement-breakpoint
CREATE TABLE `pairings` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`child_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
