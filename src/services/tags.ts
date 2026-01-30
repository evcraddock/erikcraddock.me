import { sql } from "drizzle-orm";
import { db, tags, postTags } from "@/db";

export interface TagWithCount {
  id: number;
  name: string;
  slug: string;
  count: number;
}

/**
 * List all tags with their post counts
 */
export function listTags(): TagWithCount[] {
  const result = db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      count: sql<number>`count(${postTags.post_id})`.as("count"),
    })
    .from(tags)
    .leftJoin(postTags, sql`${tags.id} = ${postTags.tag_id}`)
    .groupBy(tags.id)
    .orderBy(sql`count DESC`)
    .all();

  return result;
}
