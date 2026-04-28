CREATE TABLE `remote_follows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer,
	`actor_uri` text NOT NULL,
	`handle` text,
	`preferred_username` text,
	`display_name` text,
	`profile_url` text,
	`inbox_uri` text NOT NULL,
	`shared_inbox_uri` text,
	`avatar_url` text,
	`follow_activity_uri` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_error` text,
	`followed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `remote_follows_actor_uri_unique` ON `remote_follows` (`actor_uri`);--> statement-breakpoint
CREATE UNIQUE INDEX `remote_follows_follow_activity_uri_unique` ON `remote_follows` (`follow_activity_uri`);