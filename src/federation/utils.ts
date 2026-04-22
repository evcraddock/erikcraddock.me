import { Temporal } from "@js-temporal/polyfill";

// Domain from environment
const domain = process.env.DOMAIN || "localhost:5000";

/**
 * Determine the protocol (http or https) for a given domain.
 * Uses http for local development hosts and private LAN IPs, https otherwise.
 */
export function getProtocol(domain: string): "http" | "https" {
  const hostname = domain.split(":")[0]?.toLowerCase() ?? domain.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  ) {
    return "http";
  }

  return "https";
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
