import { eq } from "drizzle-orm";
import { db, media } from "@/db";
import { uploadFile, deleteFile, generateKey } from "./s3";
import { logger } from "@/utils/logger";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export interface MediaRecord {
  id: number;
  filename: string;
  mime_type: string;
  s3_key: string;
  alt_text: string | null;
  created_at: Date;
  url: string;
}

/**
 * Build the public URL for a media file
 */
export function mediaUrl(s3Key: string): string {
  return `/media/${s3Key}`;
}

/**
 * Validate that a MIME type is allowed
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * Upload a file and create a media record.
 * If customKey is provided, use it as the S3 key; otherwise generate one.
 */
export async function createMedia(options: {
  file: Buffer | Uint8Array;
  filename: string;
  mimeType: string;
  altText?: string;
  customKey?: string;
}): Promise<MediaRecord> {
  const { file, filename, mimeType, altText, customKey } = options;

  if (!isAllowedMimeType(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`);
  }

  const s3Key = customKey || generateKey(filename);

  await uploadFile(s3Key, file, mimeType);

  const record = db
    .insert(media)
    .values({
      filename,
      mime_type: mimeType,
      s3_key: s3Key,
      alt_text: altText || null,
      created_at: new Date(),
    })
    .returning()
    .get();

  logger.info("media", "Media created", { id: record.id, s3Key, filename });

  return { ...record, url: mediaUrl(record.s3_key) };
}

/**
 * Get a media record by ID
 */
export function getMedia(id: number): MediaRecord | null {
  const record = db.select().from(media).where(eq(media.id, id)).get();
  if (!record) return null;
  return { ...record, url: mediaUrl(record.s3_key) };
}

/**
 * Delete a media record and its S3 file
 */
export async function deleteMedia(id: number): Promise<boolean> {
  const record = db.select().from(media).where(eq(media.id, id)).get();

  if (!record) {
    logger.warn("media", "Media not found for deletion", { id });
    return false;
  }

  await deleteFile(record.s3_key);
  db.delete(media).where(eq(media.id, id)).run();

  logger.info("media", "Media deleted", { id, s3Key: record.s3_key });
  return true;
}
