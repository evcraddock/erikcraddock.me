ALTER TABLE `person_social_accounts` ADD `avatar_url` text;--> statement-breakpoint
ALTER TABLE `person_social_accounts` ADD `is_default` integer DEFAULT false NOT NULL;