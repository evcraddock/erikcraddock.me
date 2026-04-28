CREATE TABLE `remote_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`activity_uri` text NOT NULL,
	`object_uri` text NOT NULL,
	`actor_uri` text NOT NULL,
	`actor_name` text,
	`actor_url` text,
	`content_html` text NOT NULL,
	`content_text` text NOT NULL,
	`in_reply_to_uri` text NOT NULL,
	`moderation_status` text DEFAULT 'pending' NOT NULL,
	`raw_source` text NOT NULL,
	`published_at` integer,
	`received_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `remote_comments_activity_uri_unique` ON `remote_comments` (`activity_uri`);--> statement-breakpoint
CREATE UNIQUE INDEX `remote_comments_object_uri_unique` ON `remote_comments` (`object_uri`);