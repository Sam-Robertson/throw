import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function isSuppressed(channel: "SMS" | "EMAIL", value: string): Promise<boolean> {
  const entry = await prisma.suppressionEntry.findUnique({
    where: { channel_value: { channel, value } },
  });
  return entry !== null;
}

export async function addSuppression(params: {
  channel: "SMS" | "EMAIL";
  value: string;
  reason: string;
  userId?: string;
  note?: string;
}): Promise<void> {
  await prisma.suppressionEntry.upsert({
    where: { channel_value: { channel: params.channel, value: params.value } },
    update: {
      reason: params.reason,
      userId: params.userId ?? undefined,
      note: params.note ?? undefined,
    },
    create: {
      channel: params.channel,
      value: params.value,
      reason: params.reason,
      userId: params.userId ?? null,
      note: params.note ?? null,
    },
  });
}

export async function removeSuppression(channel: "SMS" | "EMAIL", value: string): Promise<void> {
  await prisma.suppressionEntry.deleteMany({ where: { channel, value } });
}

export async function canSendMarketing(
  userId: string,
  channel: "SMS" | "EMAIL",
): Promise<{ allowed: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, reason: "NO_CONTACT_VALUE" };

  const optedIn = channel === "SMS" ? user.smsMarketingOptIn : user.emailMarketingOptIn;
  if (!optedIn) return { allowed: false, reason: "NO_OPT_IN" };

  const contactValue = channel === "SMS" ? user.phone : user.email;
  if (!contactValue) return { allowed: false, reason: "NO_CONTACT_VALUE" };

  const normalized = channel === "SMS" ? normalizePhone(contactValue) : normalizeEmail(contactValue);
  if (await isSuppressed(channel, normalized)) return { allowed: false, reason: "SUPPRESSED" };

  return { allowed: true };
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sign(userId: string, channel: "SMS" | "EMAIL"): string {
  // This app's NextAuth v5 config is keyed off AUTH_SECRET (see .env); NEXTAUTH_SECRET
  // is the v4-era name some deployments still set. Prefer it per spec, but fall back
  // to the secret this app actually has configured rather than signing with "".
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET (or AUTH_SECRET) must be set to sign unsubscribe tokens");
  }
  return base64url(
    crypto.createHmac("sha256", secret).update(`${userId}:${channel}`).digest(),
  );
}

export function generateUnsubscribeToken(userId: string, channel: "SMS" | "EMAIL"): string {
  return `${userId}.${channel}.${sign(userId, channel)}`;
}

export function verifyUnsubscribeToken(
  token: string,
): { userId: string; channel: "SMS" | "EMAIL" } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, channelRaw, hmac] = parts;
  if (!userId || (channelRaw !== "SMS" && channelRaw !== "EMAIL") || !hmac) return null;

  const channel = channelRaw;
  const expected = sign(userId, channel);

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(hmac);
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) return null;

  return { userId, channel };
}
