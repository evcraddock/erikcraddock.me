import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// Posts - articles, links, and notes
export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull(), // 'article' | 'link' | 'note'
  title: text("title"),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  url: text("url"), // for link type posts
  og_title: text("og_title"),
  og_description: text("og_description"),
  og_image_url: text("og_image_url"),
  og_site_name: text("og_site_name"),
  source_id: integer("source_id").references(() => sources.id),
  banner_image_id: integer("banner_image_id").references(() => media.id, { onDelete: "set null" }),
  published_at: integer("published_at", { mode: "timestamp" }),
  created_at: integer("created_at", { mode: "timestamp" }).notNull(),
  updated_at: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Tags for categorizing posts
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

// Many-to-many relationship between posts and tags
export const postTags = sqliteTable(
  "post_tags",
  {
    post_id: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tag_id: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.post_id, table.tag_id] })]
);

// Sources for link attribution (blogroll)
export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  feed_url: text("feed_url"),
  preview_title: text("preview_title"),
  preview_description: text("preview_description"),
  preview_image_url: text("preview_image_url"),
  preview_site_name: text("preview_site_name"),
  favicon_url: text("favicon_url"),
});

export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  url: text("url"),
});

export const sourceAuthors = sqliteTable("source_authors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source_id: integer("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  person_id: integer("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  sort_order: integer("sort_order").notNull().default(0),
});

// ActivityPub followers
export const followers = sqliteTable("followers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actor_uri: text("actor_uri").notNull().unique(),
  inbox_uri: text("inbox_uri").notNull(),
  shared_inbox_uri: text("shared_inbox_uri"),
  followed_at: integer("followed_at", { mode: "timestamp" }).notNull(),
});

// Actor keys for ActivityPub signing
export const actorKeys = sqliteTable("actor_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  public_key: text("public_key").notNull(),
  private_key: text("private_key").notNull(),
  created_at: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Authors (allow list for login)
export const authors = sqliteTable("authors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  created_at: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Passkeys for WebAuthn login
export const passkeys = sqliteTable("passkeys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Nullable for admin passkeys (admin may not have an author record)
  author_id: integer("author_id").references(() => authors.id, { onDelete: "cascade" }),
  credential_id: text("credential_id").notNull().unique(),
  public_key: text("public_key").notNull(),
  name: text("name"),
  created_at: integer("created_at", { mode: "timestamp" }).notNull(),
  last_used_at: integer("last_used_at", { mode: "timestamp" }),
});

// API keys for programmatic access
export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Nullable for admin keys (admin may not have an author record)
  author_id: integer("author_id").references(() => authors.id, { onDelete: "cascade" }),
  key_hash: text("key_hash").notNull().unique(),
  name: text("name"),
  created_at: integer("created_at", { mode: "timestamp" }).notNull(),
  last_used_at: integer("last_used_at", { mode: "timestamp" }),
  revoked_at: integer("revoked_at", { mode: "timestamp" }),
});

// Magic links for email login
export const magicLinks = sqliteTable("magic_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  token_hash: text("token_hash").notNull().unique(),
  expires_at: integer("expires_at", { mode: "timestamp" }).notNull(),
  used_at: integer("used_at", { mode: "timestamp" }),
});

// Sessions for authenticated users
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // Random token (use crypto.randomUUID())
  author_id: integer("author_id").references(() => authors.id, { onDelete: "cascade" }), // null for admin
  expires_at: integer("expires_at", { mode: "timestamp" }).notNull(),
  created_at: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Media files stored in S3
export const media = sqliteTable("media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  mime_type: text("mime_type").notNull(),
  s3_key: text("s3_key").notNull().unique(),
  alt_text: text("alt_text"),
  created_at: integer("created_at", { mode: "timestamp" }).notNull(),
});
