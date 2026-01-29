import { hashToken } from "./crypto";

export const API_KEY_PREFIX = "ek_";

/**
 * Check if a string looks like a valid API key format.
 */
export function isValidApiKeyFormat(key: string): boolean {
  // Must start with prefix and have 64 hex chars after
  const pattern = new RegExp(`^${API_KEY_PREFIX}[a-f0-9]{64}$`);
  return pattern.test(key);
}

/**
 * Generate a new API key.
 * Returns { key, keyHash } - key is shown once, keyHash is stored.
 */
export async function generateApiKey(): Promise<{ key: string; keyHash: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const randomPart = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");

  const key = `${API_KEY_PREFIX}${randomPart}`;
  const keyHash = await hashToken(key);

  return { key, keyHash };
}
