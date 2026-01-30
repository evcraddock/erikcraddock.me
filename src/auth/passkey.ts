import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/server";
import { eq, isNull } from "drizzle-orm";
import { db, passkeys, authors } from "@/db";
import { logger } from "@/utils/logger";

// WebAuthn configuration
const rpName = "erikcraddock.me";
const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const origin = process.env.WEBAUTHN_ORIGIN || `http://${rpID}:5000`;

// In-memory challenge store (should use Redis in production)
const challengeStore = new Map<string, string>();

/**
 * Get passkeys for an author
 * Pass null for admin passkeys
 */
export function listPasskeys(authorId: number | null) {
  return db
    .select({
      id: passkeys.id,
      name: passkeys.name,
      created_at: passkeys.created_at,
      last_used_at: passkeys.last_used_at,
    })
    .from(passkeys)
    .where(authorId === null ? isNull(passkeys.author_id) : eq(passkeys.author_id, authorId))
    .all();
}

/**
 * Generate registration options for a new passkey
 * Pass null for admin passkeys
 */
export async function generatePasskeyRegistrationOptions(authorId: number | null, email: string) {
  // Get existing passkeys to exclude
  const existingPasskeys = db
    .select({ credential_id: passkeys.credential_id })
    .from(passkeys)
    .where(authorId === null ? isNull(passkeys.author_id) : eq(passkeys.author_id, authorId))
    .all();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: email,
    userDisplayName: email,
    attestationType: "none",
    excludeCredentials: existingPasskeys.map((p) => ({
      id: p.credential_id,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // Store challenge for verification
  challengeStore.set(email, options.challenge);

  logger.debug("passkey", "Generated registration options", { email });

  return options;
}

/**
 * Verify and store a new passkey
 * Pass null for admin passkeys
 */
export async function verifyAndStorePasskey(
  authorId: number | null,
  email: string,
  name: string,
  response: RegistrationResponseJSON
) {
  const expectedChallenge = challengeStore.get(email);

  if (!expectedChallenge) {
    logger.warn("passkey", "No challenge found for registration", { email });
    return { success: false, error: "Registration session expired" };
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      logger.warn("passkey", "Registration verification failed", { email });
      return { success: false, error: "Verification failed" };
    }

    const { credential } = verification.registrationInfo;

    // Store passkey
    const result = db
      .insert(passkeys)
      .values({
        author_id: authorId,
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey).toString("base64"),
        name: name || "Passkey",
        created_at: new Date(),
      })
      .returning()
      .get();

    // Clear challenge
    challengeStore.delete(email);

    logger.info("passkey", "Passkey registered", { email, passkeyId: result.id });

    return { success: true, passkey: result };
  } catch (error) {
    logger.error("passkey", "Registration error", { email, error });
    return { success: false, error: "Registration failed" };
  }
}

/**
 * Generate authentication options for passkey login
 */
export async function generatePasskeyAuthOptions(email?: string) {
  let allowCredentials: { id: string }[] | undefined;

  if (email) {
    // Get author's passkeys
    const author = db.select().from(authors).where(eq(authors.email, email)).get();

    if (author) {
      const authorPasskeys = db
        .select({ credential_id: passkeys.credential_id })
        .from(passkeys)
        .where(eq(passkeys.author_id, author.id))
        .all();

      allowCredentials = authorPasskeys.map((p) => ({
        id: p.credential_id,
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials,
  });

  // Store challenge
  const challengeKey = email || "anonymous";
  challengeStore.set(`auth:${challengeKey}`, options.challenge);

  logger.debug("passkey", "Generated authentication options", { email });

  return options;
}

/**
 * Verify passkey authentication and return author email
 */
export async function verifyPasskeyAuth(
  response: AuthenticationResponseJSON,
  email?: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  const challengeKey = email || "anonymous";
  const expectedChallenge = challengeStore.get(`auth:${challengeKey}`);

  if (!expectedChallenge) {
    logger.warn("passkey", "No challenge found for authentication");
    return { success: false, error: "Authentication session expired" };
  }

  // Find passkey by credential ID
  const passkey = db.select().from(passkeys).where(eq(passkeys.credential_id, response.id)).get();

  if (!passkey) {
    logger.warn("passkey", "Passkey not found", { credentialId: response.id });
    return { success: false, error: "Passkey not found" };
  }

  // Get email: admin passkeys have null author_id, use ADMIN_EMAIL
  let userEmail: string;
  if (passkey.author_id === null) {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      logger.error("passkey", "Admin passkey but ADMIN_EMAIL not set", { passkeyId: passkey.id });
      return { success: false, error: "Configuration error" };
    }
    userEmail = adminEmail;
  } else {
    const author = db.select().from(authors).where(eq(authors.id, passkey.author_id)).get();
    if (!author) {
      logger.error("passkey", "Author not found for passkey", { passkeyId: passkey.id });
      return { success: false, error: "Author not found" };
    }
    userEmail = author.email;
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credential_id,
        publicKey: Buffer.from(passkey.public_key, "base64"),
        counter: 0, // We don't track counter for simplicity
      },
    });

    if (!verification.verified) {
      logger.warn("passkey", "Authentication verification failed", { email: userEmail });
      return { success: false, error: "Verification failed" };
    }

    // Update last_used_at
    db.update(passkeys).set({ last_used_at: new Date() }).where(eq(passkeys.id, passkey.id)).run();

    // Clear challenge
    challengeStore.delete(`auth:${challengeKey}`);

    logger.info("passkey", "Passkey authentication successful", { email: userEmail });

    return { success: true, email: userEmail };
  } catch (error) {
    logger.error("passkey", "Authentication error", { error });
    return { success: false, error: "Authentication failed" };
  }
}

/**
 * Delete a passkey
 * Pass null for admin passkeys
 */
export function deletePasskey(passkeyId: number, authorId: number | null): boolean {
  const passkey = db.select().from(passkeys).where(eq(passkeys.id, passkeyId)).get();

  if (!passkey) {
    return false;
  }

  // Check ownership: admin keys have null author_id, others have specific id
  if (authorId === null) {
    if (passkey.author_id !== null) return false;
  } else {
    if (passkey.author_id !== authorId) return false;
  }

  db.delete(passkeys).where(eq(passkeys.id, passkeyId)).run();

  logger.info("passkey", "Passkey deleted", { passkeyId, authorId });

  return true;
}
