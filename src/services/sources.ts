import { eq } from "drizzle-orm";
import { db, sources } from "@/db";

export interface Source {
  id: number;
  name: string;
  url: string;
  feed_url: string | null;
}

/**
 * List all sources
 */
export function listSources(): Source[] {
  return db.select().from(sources).all();
}

/**
 * Get a single source by ID
 */
export function getSource(id: number): Source | null {
  return db.select().from(sources).where(eq(sources.id, id)).get() ?? null;
}

export interface CreateSourceInput {
  name: string;
  url: string;
  feed_url?: string | null;
}

/**
 * Create a new source
 */
export function createSource(input: CreateSourceInput): Source {
  const { name, url, feed_url } = input;

  const source = db
    .insert(sources)
    .values({
      name,
      url,
      feed_url: feed_url ?? null,
    })
    .returning()
    .get();

  return source;
}

export interface UpdateSourceInput {
  name?: string;
  url?: string;
  feed_url?: string | null;
}

/**
 * Update an existing source
 */
export function updateSource(id: number, input: UpdateSourceInput): Source | null {
  const existing = getSource(id);
  if (!existing) {
    return null;
  }

  const updates: Partial<{ name: string; url: string; feed_url: string | null }> = {};

  if (input.name !== undefined) {
    updates.name = input.name;
  }
  if (input.url !== undefined) {
    updates.url = input.url;
  }
  if (input.feed_url !== undefined) {
    updates.feed_url = input.feed_url;
  }

  if (Object.keys(updates).length === 0) {
    return existing;
  }

  const source = db.update(sources).set(updates).where(eq(sources.id, id)).returning().get();

  return source ?? null;
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
