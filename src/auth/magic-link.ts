import { eq } from "drizzle-orm";
import { db, authors, magicLinks } from "@/db";
import { logger } from "@/utils/logger";
import { sendEmail } from "@/services/email";
import { generateToken, hashToken } from "./crypto";

const TOKEN_EXPIRY_MINUTES = 15;

/**
 * Check if an email is in the authors allow list or is the admin email
 */
export async function isAuthorizedEmail(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check ADMIN_EMAIL env var first
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  if (adminEmail && normalizedEmail === adminEmail) {
    return true;
  }

  // Check authors table
  const author = db.select().from(authors).where(eq(authors.email, normalizedEmail)).get();

  return !!author;
}

/**
 * Create a magic link for the given email.
 * Returns true if email was sent (or logged in dev), false if email not authorized.
 * Always appears successful to caller to avoid leaking valid emails.
 */
export async function createMagicLink(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if email is authorized
  const isAuthorized = await isAuthorizedEmail(normalizedEmail);

  if (!isAuthorized) {
    logger.debug("auth", "Magic link requested for unauthorized email", {
      email: normalizedEmail,
    });
    // Return true to avoid revealing whether email exists
    return true;
  }

  // Generate token
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  // Store in database
  db.insert(magicLinks)
    .values({
      email: normalizedEmail,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .run();

  logger.debug("auth", "Magic link created", {
    email: normalizedEmail,
    expiresAt: expiresAt.toISOString(),
  });

  // Build the magic link URL
  const domain = process.env.DOMAIN || "localhost:5000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const magicLinkUrl = `${protocol}://${domain}/login/verify?token=${token}`;

  const devMode = process.env.SMTP_DEV_MODE === "true";

  if (!devMode) {
    // Send email via configured SMTP
    const emailSent = await sendEmail({
      to: normalizedEmail,
      subject: "Your login link",
      text: `Click here to log in: ${magicLinkUrl}\n\nThis link expires in ${TOKEN_EXPIRY_MINUTES} minutes.`,
      html: `
        <p>Click the link below to log in:</p>
        <p><a href="${magicLinkUrl}">Log in to erikcraddock.me</a></p>
        <p>This link expires in ${TOKEN_EXPIRY_MINUTES} minutes.</p>
        <p>If you didn't request this, you can ignore this email.</p>
      `,
    });

    if (!emailSent) {
      logger.error("auth", "Failed to send magic link email", { email: normalizedEmail });
    }
  } else {
    // Dev mode: log the link to console instead of sending email
    logger.info("auth", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info("auth", `Magic link for ${normalizedEmail}:`);
    logger.info("auth", magicLinkUrl);
    logger.info("auth", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  return true;
}

/**
 * Verify a magic link token.
 * Returns the email if valid, null if invalid or expired.
 */
export async function verifyMagicLink(token: string): Promise<string | null> {
  const tokenHash = await hashToken(token);

  const link = db.select().from(magicLinks).where(eq(magicLinks.token_hash, tokenHash)).get();

  if (!link) {
    logger.debug("auth", "Magic link not found");
    return null;
  }

  // Check if already used
  if (link.used_at) {
    logger.debug("auth", "Magic link already used", { email: link.email });
    return null;
  }

  // Check if expired
  // Drizzle with mode:"timestamp" returns Date objects, but test DB returns seconds as number
  const expiresAtMs =
    link.expires_at instanceof Date ? link.expires_at.getTime() : Number(link.expires_at) * 1000;
  if (expiresAtMs < Date.now()) {
    logger.debug("auth", "Magic link expired", { email: link.email });
    return null;
  }

  // Mark as used
  db.update(magicLinks).set({ used_at: new Date() }).where(eq(magicLinks.id, link.id)).run();

  logger.info("auth", "Magic link verified", { email: link.email });

  return link.email;
}

export { hashToken, generateToken } from "./crypto";
