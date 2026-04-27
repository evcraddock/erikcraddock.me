import { asc, eq } from "drizzle-orm";
import { db, people, sourceAuthors, sourceSocialAccounts, sources } from "@/db";

export interface SourceAuthor {
  id: number;
  name: string;
  url: string | null;
  sort_order: number;
}

export interface SourceSocialAccount {
  id: number;
  source_id: number;
  label: string;
  url: string;
  avatar_url: string | null;
  is_activitypub: boolean;
  is_default: boolean;
  sort_order: number;
}

export interface Source {
  id: number;
  name: string;
  url: string;
  feed_url: string | null;
  preview_title: string | null;
  preview_description: string | null;
  preview_image_url: string | null;
  preview_site_name: string | null;
  favicon_url: string | null;
  authors: SourceAuthor[];
  social_accounts: SourceSocialAccount[];
}

export interface SourceAuthorInput {
  name: string;
  url?: string | null;
}

export interface SourceSocialAccountInput {
  label: string;
  url: string;
  avatar_url?: string | null;
  is_activitypub?: boolean;
  is_default?: boolean;
}

type SourceRecord = typeof sources.$inferSelect;

function listAuthorsForSource(sourceId: number): SourceAuthor[] {
  return db
    .select({
      id: people.id,
      name: people.name,
      url: people.url,
      sort_order: sourceAuthors.sort_order,
    })
    .from(sourceAuthors)
    .innerJoin(people, eq(sourceAuthors.person_id, people.id))
    .where(eq(sourceAuthors.source_id, sourceId))
    .orderBy(asc(sourceAuthors.sort_order), asc(sourceAuthors.id))
    .all();
}

function listSocialAccountsForSource(sourceId: number): SourceSocialAccount[] {
  return db
    .select()
    .from(sourceSocialAccounts)
    .where(eq(sourceSocialAccounts.source_id, sourceId))
    .orderBy(asc(sourceSocialAccounts.sort_order), asc(sourceSocialAccounts.id))
    .all();
}

function attachSourceDetails(source: SourceRecord): Source {
  return {
    ...source,
    authors: listAuthorsForSource(source.id),
    social_accounts: listSocialAccountsForSource(source.id),
  };
}

function getOrCreatePerson(author: SourceAuthorInput): number {
  const existing = db.select().from(people).where(eq(people.name, author.name)).get();
  if (existing) {
    if (author.url && !existing.url) {
      db.update(people).set({ url: author.url }).where(eq(people.id, existing.id)).run();
    }
    return existing.id;
  }

  const person = db
    .insert(people)
    .values({ name: author.name, url: author.url ?? null })
    .returning()
    .get();

  return person.id;
}

function replaceSourceAuthors(sourceId: number, authors: SourceAuthorInput[]): void {
  db.delete(sourceAuthors).where(eq(sourceAuthors.source_id, sourceId)).run();

  if (authors.length === 0) {
    return;
  }

  db.insert(sourceAuthors)
    .values(
      authors.map((author, index) => ({
        source_id: sourceId,
        person_id: getOrCreatePerson(author),
        sort_order: index,
      }))
    )
    .run();
}

function replaceSourceSocialAccounts(sourceId: number, accounts: SourceSocialAccountInput[]): void {
  db.delete(sourceSocialAccounts).where(eq(sourceSocialAccounts.source_id, sourceId)).run();

  if (accounts.length === 0) {
    return;
  }

  const defaultIndex = accounts.findIndex((account) => account.is_default);

  db.insert(sourceSocialAccounts)
    .values(
      accounts.map((account, index) => ({
        source_id: sourceId,
        label: account.label,
        url: account.url,
        avatar_url: account.avatar_url ?? null,
        is_activitypub: account.is_activitypub ?? false,
        is_default: defaultIndex === index,
        sort_order: index,
      }))
    )
    .run();
}

/**
 * List all sources
 */
export function listSources(): Source[] {
  return db.select().from(sources).all().map(attachSourceDetails);
}

/**
 * Get a single source by ID
 */
export function getSource(id: number): Source | null {
  const source = db.select().from(sources).where(eq(sources.id, id)).get();
  return source ? attachSourceDetails(source) : null;
}

export interface SourceMetadataInput {
  preview_title?: string | null;
  preview_description?: string | null;
  preview_image_url?: string | null;
  preview_site_name?: string | null;
  favicon_url?: string | null;
}

export interface CreateSourceInput extends SourceMetadataInput {
  name: string;
  url: string;
  feed_url?: string | null;
  authors?: SourceAuthorInput[];
  social_accounts?: SourceSocialAccountInput[];
}

/**
 * Create a new source
 */
export function createSource(input: CreateSourceInput): Source {
  const {
    name,
    url,
    feed_url,
    authors,
    social_accounts,
    preview_title,
    preview_description,
    preview_image_url,
    preview_site_name,
    favicon_url,
  } = input;

  const source = db
    .insert(sources)
    .values({
      name,
      url,
      feed_url: feed_url ?? null,
      preview_title: preview_title ?? null,
      preview_description: preview_description ?? null,
      preview_image_url: preview_image_url ?? null,
      preview_site_name: preview_site_name ?? null,
      favicon_url: favicon_url ?? null,
    })
    .returning()
    .get();

  replaceSourceAuthors(source.id, authors ?? []);
  replaceSourceSocialAccounts(source.id, social_accounts ?? []);

  return attachSourceDetails(source);
}

export interface UpdateSourceInput extends SourceMetadataInput {
  name?: string;
  url?: string;
  feed_url?: string | null;
  authors?: SourceAuthorInput[];
  social_accounts?: SourceSocialAccountInput[];
}

/**
 * Update an existing source
 */
export function updateSource(id: number, input: UpdateSourceInput): Source | null {
  const existing = getSource(id);
  if (!existing) {
    return null;
  }

  const updates: Partial<{
    name: string;
    url: string;
    feed_url: string | null;
    preview_title: string | null;
    preview_description: string | null;
    preview_image_url: string | null;
    preview_site_name: string | null;
    favicon_url: string | null;
  }> = {};

  if (input.name !== undefined) {
    updates.name = input.name;
  }
  if (input.url !== undefined) {
    updates.url = input.url;
  }
  if (input.feed_url !== undefined) {
    updates.feed_url = input.feed_url;
  }
  if (input.preview_title !== undefined) {
    updates.preview_title = input.preview_title;
  }
  if (input.preview_description !== undefined) {
    updates.preview_description = input.preview_description;
  }
  if (input.preview_image_url !== undefined) {
    updates.preview_image_url = input.preview_image_url;
  }
  if (input.preview_site_name !== undefined) {
    updates.preview_site_name = input.preview_site_name;
  }
  if (input.favicon_url !== undefined) {
    updates.favicon_url = input.favicon_url;
  }

  if (Object.keys(updates).length > 0) {
    db.update(sources).set(updates).where(eq(sources.id, id)).returning().get();
  }

  if (input.authors !== undefined) {
    replaceSourceAuthors(id, input.authors);
  }

  if (input.social_accounts !== undefined) {
    replaceSourceSocialAccounts(id, input.social_accounts);
  }

  return getSource(id);
}

/**
 * Delete a source by ID
 */
export function deleteSource(id: number): boolean {
  const existing = getSource(id);
  if (!existing) {
    return false;
  }

  db.delete(sources).where(eq(sources.id, id)).run();
  return true;
}
