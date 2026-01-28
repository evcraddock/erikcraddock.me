import { generateCryptoKeyPair, exportJwk, importJwk } from "@fedify/fedify";
import { eq } from "drizzle-orm";
import { db, actorKeys } from "@/db";
import { logger } from "@/utils/logger";

// CryptoKeyPair is a Web Crypto API type
interface KeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

/**
 * Get or create the actor key pair.
 * Since this is a single-user blog, we only need one key pair.
 * The key pair is stored in the database in JWK format.
 */
export async function getOrCreateKeyPair(): Promise<KeyPair> {
  // Try to load existing key pair
  const existing = db.select().from(actorKeys).where(eq(actorKeys.id, 1)).get();

  if (existing) {
    logger.debug("federation", "Loading existing actor key pair");
    const privateKey = await importJwk(JSON.parse(existing.private_key), "private");
    const publicKey = await importJwk(JSON.parse(existing.public_key), "public");
    return { privateKey, publicKey };
  }

  // Generate new key pair
  logger.info("federation", "Generating new actor key pair");
  const keyPair = await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");

  // Store in database as JWK
  const privateJwk = await exportJwk(keyPair.privateKey);
  const publicJwk = await exportJwk(keyPair.publicKey);

  db.insert(actorKeys)
    .values({
      id: 1,
      private_key: JSON.stringify(privateJwk),
      public_key: JSON.stringify(publicJwk),
      created_at: new Date(),
    })
    .run();

  logger.info("federation", "Actor key pair generated and stored");
  return keyPair;
}

/**
 * Get the actor key pair if it exists, or null if not yet generated.
 */
export async function getKeyPair(): Promise<KeyPair | null> {
  const existing = db.select().from(actorKeys).where(eq(actorKeys.id, 1)).get();

  if (!existing) {
    return null;
  }

  const privateKey = await importJwk(JSON.parse(existing.private_key), "private");
  const publicKey = await importJwk(JSON.parse(existing.public_key), "public");
  return { privateKey, publicKey };
}
