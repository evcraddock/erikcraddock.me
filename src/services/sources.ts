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
