import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";

/**
 * Password setup / reset links.
 *
 * One flow serves both imported Momence members (who have no password yet —
 * "Set up your account") and existing users who forgot theirs ("Reset your
 * password"). Tokens live in the NextAuth VerificationToken table rather than
 * new User columns:
 *
 *   identifier  "password-setup:<lowercased email>"
 *   token       SHA-256 hex of the random token (the raw token is only ever in
 *               the emailed link, never stored)
 *   expires     issue time + 24h
 *
 * Issuing a token deletes any earlier ones for the same email, and using one
 * deletes it, so a link works once.
 */

export const PASSWORD_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const IDENTIFIER_PREFIX = "password-setup:";
const DEFAULT_FROM = "Throw Art Studio <hello@throwartstudio.com>";

export type PasswordEmailMode = "setup" | "reset";

export function passwordTokenIdentifier(email: string): string {
  return IDENTIFIER_PREFIX + email.trim().toLowerCase();
}

export function hashPasswordToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** "setup" for users who have never had a password (e.g. Momence imports). */
export function passwordEmailMode(user: { hashedPassword: string | null }): PasswordEmailMode {
  return user.hashedPassword ? "reset" : "setup";
}

/** Creates a fresh token for `email`, replacing any earlier one. Returns the raw token. */
export async function createPasswordToken(email: string): Promise<string> {
  const identifier = passwordTokenIdentifier(email);
  const rawToken = crypto.randomBytes(32).toString("base64url");

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: {
        identifier,
        token: hashPasswordToken(rawToken),
        expires: new Date(Date.now() + PASSWORD_TOKEN_TTL_MS),
      },
    }),
  ]);

  return rawToken;
}

/**
 * True if a token for `email` was issued within the last `windowMs`.
 * VerificationToken has no createdAt, so issue time is derived from expires.
 */
export async function hasRecentPasswordToken(email: string, windowMs: number): Promise<boolean> {
  const latest = await prisma.verificationToken.findFirst({
    where: { identifier: passwordTokenIdentifier(email) },
    orderBy: { expires: "desc" },
    select: { expires: true },
  });
  if (!latest) return false;
  const issuedAt = latest.expires.getTime() - PASSWORD_TOKEN_TTL_MS;
  return Date.now() - issuedAt < windowMs;
}

export type ResolvedPasswordToken =
  | {
      status: "valid";
      tokenHash: string;
      mode: PasswordEmailMode;
      user: { id: string; email: string; name: string | null; emailVerified: Date | null };
    }
  | { status: "expired" }
  | { status: "invalid" };

/** Looks up a raw token from a link. Deletes it if it has expired. Does not consume it. */
export async function resolvePasswordToken(rawToken: string): Promise<ResolvedPasswordToken> {
  if (!rawToken || rawToken.length > 200) return { status: "invalid" };

  const tokenHash = hashPasswordToken(rawToken);
  const row = await prisma.verificationToken.findUnique({ where: { token: tokenHash } });
  if (!row || !row.identifier.startsWith(IDENTIFIER_PREFIX)) return { status: "invalid" };

  if (row.expires.getTime() < Date.now()) {
    await prisma.verificationToken.deleteMany({ where: { token: tokenHash } });
    return { status: "expired" };
  }

  const email = row.identifier.slice(IDENTIFIER_PREFIX.length);
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true, emailVerified: true, hashedPassword: true },
  });
  if (!user) return { status: "invalid" };

  return {
    status: "valid",
    tokenHash,
    mode: passwordEmailMode(user),
    user: { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified },
  };
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPasswordEmail({
  name,
  link,
  mode,
}: {
  name: string | null;
  link: string;
  mode: PasswordEmailMode;
}): { subject: string; text: string; html: string } {
  const firstName = name?.trim().split(/\s+/)[0] ?? "";
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  const subject = mode === "setup" ? "Set up your Throw Art Studio account" : "Reset your Throw Art Studio password";
  const heading = mode === "setup" ? "Set up your account" : "Reset your password";
  const intro =
    mode === "setup"
      ? "Throw Art Studio has moved to a new booking system, and your account came with you — your membership, class history and details are already here. Choose a password to sign in."
      : "We got a request to reset the password for your Throw Art Studio account. Choose a new one using the link below.";
  const cta = mode === "setup" ? "Set my password" : "Reset my password";
  const footer =
    mode === "setup"
      ? "This link expires in 24 hours. If it runs out, use \"Forgot password\" on the sign-in page to get a new one."
      : "This link expires in 24 hours and works once. If you didn't ask for this, you can ignore this email — your password won't change.";

  const text = [greeting, "", intro, "", `${cta}: ${link}`, "", footer, "", "Throw Art Studio"].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f7f5f2;font-family:Helvetica,Arial,sans-serif;color:#1f1f1f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 16px;font-size:22px;">${escapeHtml(heading)}</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.5;">${escapeHtml(intro)}</p>
        <p style="margin:0 0 24px;">
          <a href="${escapeHtml(link)}" style="display:inline-block;background:#1f1f1f;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;">${escapeHtml(cta)}</a>
        </p>
        <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#555555;">${escapeHtml(footer)}</p>
        <p style="margin:0;font-size:13px;line-height:1.5;color:#555555;">If the button doesn't work, paste this into your browser:<br>${escapeHtml(link)}</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

/**
 * Sends the setup/reset email. Never throws: a missing RESEND_API_KEY or a
 * Resend error is logged and reported as { sent: false } so callers (notably
 * request-reset, which must always return 200) keep going.
 */
export async function sendPasswordEmail({
  to,
  name,
  rawToken,
  mode,
}: {
  to: string;
  name: string | null;
  rawToken: string;
  mode: PasswordEmailMode;
}): Promise<{ sent: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[passwordSetup] RESEND_API_KEY is not set — password email not sent.");
    return { sent: false, error: "RESEND_API_KEY is not set" };
  }

  const link = `${appUrl()}/set-password?token=${encodeURIComponent(rawToken)}`;
  const { subject, text, html } = buildPasswordEmail({ name, link, mode });

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM,
      to,
      subject,
      text,
      html,
    });
    if (error) {
      console.error("[passwordSetup] Resend rejected the password email:", error.message);
      return { sent: false, error: error.message };
    }
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[passwordSetup] Failed to send password email:", message);
    return { sent: false, error: message };
  }
}

/**
 * Issues a token and emails it. If the email doesn't go out, the token is
 * deleted again, so a later retry (or the invite script's "already has an
 * unexpired token" skip) isn't fooled by a link nobody received.
 */
export async function issuePasswordEmail(user: {
  email: string;
  name: string | null;
  hashedPassword: string | null;
}): Promise<{ sent: boolean; mode: PasswordEmailMode; error?: string }> {
  const mode = passwordEmailMode(user);
  const rawToken = await createPasswordToken(user.email);
  const result = await sendPasswordEmail({ to: user.email, name: user.name, rawToken, mode });

  if (!result.sent) {
    await prisma.verificationToken.deleteMany({ where: { token: hashPasswordToken(rawToken) } });
  }

  return { ...result, mode };
}
