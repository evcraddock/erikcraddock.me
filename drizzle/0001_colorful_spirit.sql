-- Add slug column as nullable first (SQLite can't add NOT NULL to existing table)
ALTER TABLE `posts` ADD `slug` text;--> statement-breakpoint

-- Generate slugs for existing posts
UPDATE `posts` SET `slug` = 'post-' || `id` WHERE `slug` IS NULL;--> statement-breakpoint

-- Create unique index to enforce uniqueness (NOT NULL enforced at app level)
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);
