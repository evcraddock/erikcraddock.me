CREATE TABLE `source_social_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` integer NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`avatar_url` text,
	`is_activitypub` integer DEFAULT false NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
