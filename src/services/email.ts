import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { logger } from "@/utils/logger";

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter | null = null;

function getConfig(): EmailConfig {
  const host = process.env.SMTP_HOST || "localhost";
  const port = parseInt(process.env.SMTP_PORT || "1025", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const config: EmailConfig = {
    host,
    port,
    secure,
  };

  // Only add auth if credentials are provided
  if (user && pass) {
    config.auth = { user, pass };
  }

  return config;
}

function getTransporter(): Transporter {
  if (!transporter) {
    const config = getConfig();
    logger.debug("email", "Initializing email transporter", {
      host: config.host,
      port: config.port,
      secure: config.secure,
      hasAuth: !!config.auth,
    });
    transporter = nodemailer.createTransport(config);
  }
  return transporter;
}

/**
 * Send an email
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const from = process.env.FROM_EMAIL || "noreply@erikcraddock.me";
  const transport = getTransporter();

  logger.debug("email", "Sending email", {
    to: options.to,
    subject: options.subject,
    from,
  });

  try {
    const result = await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    logger.info("email", "Email sent", {
      to: options.to,
      messageId: result.messageId,
    });

    return true;
  } catch (error) {
    logger.error("email", "Failed to send email", {
      to: options.to,
      error: String(error),
    });

    // In development, log the email content so it's not lost
    if (process.env.NODE_ENV === "development") {
      logger.debug("email", "Email content (dev fallback)", {
        to: options.to,
        subject: options.subject,
        text: options.text.substring(0, 200) + "...",
      });
    }

    return false;
  }
}

/**
 * Verify the email transport connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  const transport = getTransporter();

  try {
    await transport.verify();
    logger.info("email", "Email connection verified");
    return true;
  } catch (error) {
    logger.warn("email", "Email connection failed", {
      error: String(error),
    });
    return false;
  }
}
