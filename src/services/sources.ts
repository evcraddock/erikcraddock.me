import { asc, eq } from "drizzle-orm";
import { db, people, sourceAuthors, sources } from "@/db";

export interface SourceAuthor {
  id: number;
  name: string;
  url: string | null;
  sort_order: number;
}

export interface Source {
  id: number;
  name: string;
  url: string;
  feed_url: string | null;
  authors: SourceAuthor[];
}

export interface SourceAuthorInput {
  name: string;
  url?: string | null;
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

function attachAuthors(source: SourceRecord): Source {
  return { ...source, authors: listAuthorsForSource(source.id) };
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

/**
 * List all sources
 */
export function listSources(): Source[] {
  return db
    .select()
    .from(sources)
    .all()
    .map((source) => attachAuthors(source));
}

/**
 * Get a single source by ID
 */
export function getSource(id: number): Source | null {
  const source = db.select().from(sources).where(eq(sources.id, id)).get();
  return source ? attachAuthors(source) : null;
}

export interface CreateSourceInput {
  name: string;
  url: string;
  feed_url?: string | null;
  authors?: SourceAuthorInput[];
}

/**
 * Create a new source
 */
export function createSource(input: CreateSourceInput): Source {
  const { name, url, feed_url, authors } = input;

  const source = db
    .insert(sources)
    .values({
      name,
      url,
      feed_url: feed_url ?? null,
    })
    .returning()
    .get();

  replaceSourceAuthors(source.id, authors ?? []);

  return attachAuthors(source);
}

export interface UpdateSourceInput {
  name?: string;
  url?: string;
  feed_url?: string | null;
  authors?: SourceAuthorInput[];
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

  if (Object.keys(updates).length > 0) {
    db.update(sources).set(updates).where(eq(sources.id, id)).returning().get();
  }

  if (input.authors !== undefined) {
    replaceSourceAuthors(id, input.authors);
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
