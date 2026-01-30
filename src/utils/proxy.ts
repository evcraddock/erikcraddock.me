/**
 * Utilities for handling reverse proxy headers.
 *
 * When running behind a reverse proxy (like Caddy), requests come in with
 * http:// URLs even though the original request was https://. These utilities
 * help rewrite URLs to use the correct protocol.
 */

/**
 * Rewrite a URL to use the protocol and host from proxy headers.
 *
 * @param originalUrl The original request URL (may have wrong protocol)
 * @param forwardedProto The X-Forwarded-Proto header value (e.g., "https")
 * @param forwardedHost The X-Forwarded-Host or Host header value
 * @returns A new URL with the correct protocol, or the original if no rewrite needed
 */
export function rewriteUrlForProxy(
  originalUrl: string,
  forwardedProto: string | undefined,
  forwardedHost: string | undefined
): string {
  // Only rewrite if we have proxy headers indicating HTTPS
  if (forwardedProto !== "https" || !forwardedHost) {
    return originalUrl;
  }

  const url = new URL(originalUrl);

  // If already https, no need to rewrite
  if (url.protocol === "https:") {
    return originalUrl;
  }

  // Construct new URL with https and forwarded host
  const newUrl = new URL(url.pathname + url.search, `https://${forwardedHost}`);
  return newUrl.toString();
}

/**
 * Check if a URL uses the HTTPS protocol.
 */
export function isHttps(url: string): boolean {
  return url.startsWith("https://");
}
