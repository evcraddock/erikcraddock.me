/**
 * Normalize an email address: lowercase and trim whitespace.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Check if an email address is valid (basic check: non-empty and contains @).
 */
export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && normalized.includes("@");
}

/**
 * Check if a user is trying to delete themselves.
 */
export function isSelfDelete(authorEmail: string, currentUserEmail: string): boolean {
  return normalizeEmail(authorEmail) === normalizeEmail(currentUserEmail);
}
