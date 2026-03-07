/**
 * Email sending abstraction.
 *
 * In development (no SMTP_* env vars), emails are logged to the console.
 * In production, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and
 * EMAIL_FROM to send real emails via SMTP (works with Resend, SendGrid,
 * Mailgun, SES, etc.).
 */

import { randomBytes, createHash } from "crypto";

const EMAIL_FROM = process.env.EMAIL_FROM ?? "CCNA StudyLab <noreply@example.com>";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(options: EmailOptions): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    // Dynamic import to avoid requiring nodemailer when not configured
    const nodemailer = await import("nodemailer");
    const port = Number(SMTP_PORT ?? 587);
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transport.sendMail({ from: EMAIL_FROM, ...options });
  } else {
    // Dev mode: log to console
    console.log("\n📧 ═══════════════════════════════════════════");
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log("─────────────────────────────────────────────");
    console.log(options.html.replace(/<[^>]*>/g, ""));
    console.log("═══════════════════════════════════════════════\n");
  }
}

/**
 * Generate a secure random token for email verification or password reset.
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash a token with SHA-256 for secure storage.
 * The raw token is sent to the user via email; only the hash is stored in the DB.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Send an email verification link to a new user.
 */
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  await sendEmail({
    to: email,
    subject: "Verify your CCNA StudyLab email",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Welcome to CCNA StudyLab!</h2>
        <p>Click the link below to verify your email address:</p>
        <p><a href="${url}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Verify Email</a></p>
        <p style="color: #666; font-size: 14px;">Or copy this link: ${url}</p>
        <p style="color: #999; font-size: 12px;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
      </div>
    `,
  });
}

/**
 * Send a password reset link.
 */
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

  await sendEmail({
    to: email,
    subject: "Reset your CCNA StudyLab password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>You requested a password reset for your CCNA StudyLab account.</p>
        <p><a href="${url}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Reset Password</a></p>
        <p style="color: #666; font-size: 14px;">Or copy this link: ${url}</p>
        <p style="color: #999; font-size: 12px;">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}
