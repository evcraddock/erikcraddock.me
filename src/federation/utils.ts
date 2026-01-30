import { Temporal } from "@js-temporal/polyfill";

// Domain from environment
const domain = process.env.DOMAIN || "localhost:5000";

/**
 * Determine the protocol (http or https) for a given domain.
 * Uses http for localhost, https for everything else.
 */
export function getProtocol(domain: string): "http" | "https" {
  return domain.includes("localhost") ? "http" : "https";
}

/**
 * Build the canonical origin URL for a domain.
 * Returns http://localhost:PORT for localhost, https://domain for production.
 */
export function getOrigin(domain: string): string {
  const protocol = getProtocol(domain);
  return `${protocol}://${domain}`;
}

export const baseUrl = getOrigin(domain);

/**
 * Convert a Date to Temporal.Instant for Fedify.
 */
export function dateToInstant(date: Date): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime());
}
