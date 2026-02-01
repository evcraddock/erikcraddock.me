import { generateCryptoKeyPair, exportJwk, importJwk } from "@fedify/fedify";
import { eq } from "drizzle-orm";
import { db, actorKeys } from "@/db";
import { logger } from "@/utils/logger";

// CryptoKeyPair is a Web Crypto API type
interface KeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

// Key IDs in database
const RSA_KEY_ID = 1; // For HTTP Signatures (legacy, widely supported)
const ED25519_KEY_ID = 2; // For Object Integrity Proofs (modern standard)

/**
 * Get or create a key pair of the specified algorithm.
 */
async function getOrCreateKeyPairByAlgorithm(
  id: number,
  algorithm: "RSASSA-PKCS1-v1_5" | "Ed25519"
): Promise<KeyPair> {
  const existing = db.select().from(actorKeys).where(eq(actorKeys.id, id)).get();

  if (existing) {
    logger.debug("federation", `Loading existing ${algorithm} key pair`);
    const privateKey = await importJwk(JSON.parse(existing.private_key), "private");
    const publicKey = await importJwk(JSON.parse(existing.public_key), "public");
    return { privateKey, publicKey };
  }

  // Generate new key pair
  logger.info("federation", `Generating new ${algorithm} key pair`);
  const keyPair = await generateCryptoKeyPair(algorithm);

  // Store in database as JWK
  const privateJwk = await exportJwk(keyPair.privateKey);
  const publicJwk = await exportJwk(keyPair.publicKey);

  db.insert(actorKeys)
    .values({
      id,
      private_key: JSON.stringify(privateJwk),
      public_key: JSON.stringify(publicJwk),
      created_at: new Date(),
    })
    .run();

  logger.info("federation", `${algorithm} key pair generated and stored`);
  return keyPair;
}

/**
 * Get or create all actor key pairs.
 * Returns both RSA (for HTTP Signatures) and Ed25519 (for Object Integrity Proofs).
 * RSA key is returned first as it's used for the legacy publicKey field.
 */
export async function getOrCreateKeyPairs(): Promise<KeyPair[]> {
  const rsaKey = await getOrCreateKeyPairByAlgorithm(RSA_KEY_ID, "RSASSA-PKCS1-v1_5");
  const ed25519Key = await getOrCreateKeyPairByAlgorithm(ED25519_KEY_ID, "Ed25519");
  return [rsaKey, ed25519Key];
}

/**
 * Get or create the RSA key pair (for backwards compatibility).
 * @deprecated Use getOrCreateKeyPairs() instead
 */
export async function getOrCreateKeyPair(): Promise<KeyPair> {
  return getOrCreateKeyPairByAlgorithm(RSA_KEY_ID, "RSASSA-PKCS1-v1_5");
}

/**
 * Get the RSA key pair if it exists, or null if not yet generated.
 */
export async function getKeyPair(): Promise<KeyPair | null> {
  const existing = db.select().from(actorKeys).where(eq(actorKeys.id, RSA_KEY_ID)).get();

  if (!existing) {
    return null;
  }

  const privateKey = await importJwk(JSON.parse(existing.private_key), "private");
  const publicKey = await importJwk(JSON.parse(existing.public_key), "public");
  return { privateKey, publicKey };
}
