import { Temporal } from "@js-temporal/polyfill";

// Domain from environment
const domain = process.env.DOMAIN || "localhost:5000";
const protocol = domain.includes("localhost") ? "http" : "https";

export const baseUrl = `${protocol}://${domain}`;

/**
 * Convert a Date to Temporal.Instant for Fedify.
 */
export function dateToInstant(date: Date): Temporal.Instant {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime());
}
