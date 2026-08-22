import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone, addSuppression, removeSuppression } from "@/lib/consent";

export const dynamic = "force-dynamic";

const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPT OUT", "REVOKE"]);
const START_KEYWORDS = new Set(["START", "UNSTOP", "YES"]);
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

interface SendblueWebhookBody {
  content?: string;
  is_outbound?: boolean;
  status?: string;
  message_handle?: string;
  from_number?: string;
  to_number?: string;
  service?: string;
}

// Sendblue sends the configured secret verbatim in this header rather than
// an HMAC signature (see docs.sendblue.com/security) — verification is a
// direct string compare, done in constant time. Anything short of an exact
// match (including the secret not being configured at all) is rejected;
// there's no "unset means open" fallback, since that would silently accept
// every request once someone forgot to set the env var.
function isValidSignature(req: NextRequest): boolean {
  const expected = process.env.SENDBLUE_WEBHOOK_SECRET;
  if (!expected) return false;

  const provided = req.headers.get("sb-signing-secret") ?? "";
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export async function POST(req: NextRequest) {
  if (!isValidSignature(req)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: SendblueWebhookBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Outbound delivery-status updates land on this same endpoint
  // (is_outbound: true). Nothing currently consumes those — acknowledge and
  // move on rather than trying to process them as an inbound message.
  if (body.is_outbound) {
    return NextResponse.json({ ok: true });
  }

  const normalizedFrom = normalizePhone(body.from_number ?? "");
  const trimmedBody = (body.content ?? "").trim();
  const upperBody = trimmedBody.toUpperCase();

  if (STOP_KEYWORDS.has(upperBody)) {
    await addSuppression({ channel: "SMS", value: normalizedFrom, reason: "STOP_REPLY" });
    const user = await prisma.user.findFirst({ where: { phone: normalizedFrom } });
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { smsMarketingOptIn: false } });
    }
    return NextResponse.json({ ok: true });
  }

  if (START_KEYWORDS.has(upperBody)) {
    await removeSuppression("SMS", normalizedFrom);
    const user = await prisma.user.findFirst({ where: { phone: normalizedFrom } });
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          smsMarketingOptIn: true,
          smsMarketingOptInAt: new Date(),
          smsMarketingOptInSource: "sms_start_reply",
        },
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (HELP_KEYWORDS.has(upperBody)) {
    return NextResponse.json({ ok: true });
  }

  // Non-keyword message — log to the inbox if we can identify the sender.
  // Conversation.userId is required, so a message from an unknown number
  // has nowhere to be filed and is dropped.
  const user = await prisma.user.findFirst({ where: { phone: normalizedFrom } });
  if (user) {
    let conversation = await prisma.conversation.findFirst({
      where: { userId: user.id, channel: "sms" },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { userId: user.id, channel: "sms" },
      });
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          direction: "inbound",
          body: trimmedBody,
          isRead: false,
          createdAt: now,
        },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { adminUnread: { increment: 1 }, lastMessageAt: now },
      }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
