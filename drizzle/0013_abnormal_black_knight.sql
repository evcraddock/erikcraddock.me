CREATE TABLE `remote_likes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`object_uri` text NOT NULL,
	`activity_uri` text NOT NULL,
	`actor_uri` text NOT NULL,
	`actor_name` text,
	`raw_object_uri` text NOT NULL,
	`received_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `remote_likes_activity_uri_unique` ON `remote_likes` (`activity_uri`);