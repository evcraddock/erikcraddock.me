import { eq } from "drizzle-orm";
import { db, authors } from "@/db";
import { logger } from "@/utils/logger";

/**
 * List all authors
 */
export function listAuthors() {
  return db.select().from(authors).all();
}

/**
 * Add an email to the authors allow list.
 * Returns the new author, or null if the email already exists.
 */
export function addAuthor(email: string): { id: number; email: string; created_at: Date } | null {
  const normalized = email.toLowerCase().trim();

  if (!normalized || !normalized.includes("@")) {
    logger.warn("authors", "Invalid email provided", { email });
    return null;
  }

  // Check if already exists
  const existing = db.select().from(authors).where(eq(authors.email, normalized)).get();
  if (existing) {
    logger.debug("authors", "Author already exists", { email: normalized });
    return null;
  }

  const result = db
    .insert(authors)
    .values({
      email: normalized,
      created_at: new Date(),
    })
    .returning()
    .get();

  logger.info("authors", "Author added", { email: normalized });
  return result;
}

/**
 * Delete an author by ID.
 * Returns false if the author doesn't exist or if trying to delete the admin.
 */
export function deleteAuthor(authorId: number, currentEmail: string): boolean {
  const author = db.select().from(authors).where(eq(authors.id, authorId)).get();

  if (!author) {
    logger.warn("authors", "Author not found for deletion", { authorId });
    return false;
  }

  if (author.email.toLowerCase() === currentEmail.toLowerCase()) {
    logger.warn("authors", "Cannot delete own email", { email: currentEmail });
    return false;
  }

  db.delete(authors).where(eq(authors.id, authorId)).run();
  logger.info("authors", "Author deleted", { authorId, email: author.email });
  return true;
}
