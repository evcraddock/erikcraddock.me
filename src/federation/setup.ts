import { createFederation, Person, CryptographicKey, MemoryKvStore } from "@fedify/fedify";
import { getOrCreateKeyPair } from "./keys";
import { logger } from "@/utils/logger";

// Context type for federation - we use void since we don't need request-specific data
export type FederationContext = void;

// Domain from environment
const domain = process.env.DOMAIN || "localhost:5000";

/**
 * Create and configure the Fedify federation instance.
 *
 * This sets up:
 * - KV store for Fedify's internal state (using in-memory for now, can switch to SQLite)
 * - Actor dispatcher for /users/{identifier}
 * - Key pairs dispatcher for HTTP signatures
 */
export function createFedifyFederation() {
  logger.info("federation", `Creating federation for domain: ${domain}`);

  const federation = createFederation<FederationContext>({
    kv: new MemoryKvStore(), // TODO: Switch to SqliteKvStore for production
  });

  // Set up actor dispatcher - handles requests for /users/{identifier}
  // For this single-user blog, only "erik" is a valid identifier
  federation
    .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
      if (identifier !== "erik") {
        return null; // Only support the single user
      }

      // Get or create key pair for this actor
      const keyPair = await getOrCreateKeyPair();

      const actorUri = ctx.getActorUri(identifier);

      // Note: inbox, outbox, following, followers will be added in subsequent tasks
      // For now, we just set up the basic actor with key pair
      return new Person({
        id: actorUri,
        preferredUsername: identifier,
        name: "Erik Craddock",
        summary: "Personal blog - articles, links, and notes",
        url: new URL("/", ctx.url),
        publicKey: new CryptographicKey({
          id: new URL(`${actorUri}#main-key`),
          owner: actorUri,
          publicKey: keyPair.publicKey,
        }),
      });
    })
    // Set up key pairs dispatcher - provides keys for HTTP signatures
    .setKeyPairsDispatcher(async (_ctx, identifier) => {
      if (identifier !== "erik") {
        return [];
      }

      const keyPair = await getOrCreateKeyPair();
      return [keyPair];
    });

  logger.info("federation", "Federation configured");
  return federation;
}

// Export the federation instance
export const federation = createFedifyFederation();
