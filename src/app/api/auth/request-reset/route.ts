import { after, type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRecentPasswordToken, issuePasswordEmail } from "@/lib/email/passwordSetup";

// Public. Always answers 200 with the same body — whether or not the email
// belongs to an account, and whether or not the email actually sent — so it
// can't be used to discover who has an account. The lookup and send run after
// the response (next/server `after`) so response timing doesn't give it away
// either.

const RESPONSE = {
  ok: true,
  message: "If an account exists for that email, we've sent a link to set your password. It expires in 24 hours.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Minimal abuse protection without extra infrastructure: at most one email per
// address per minute, based on when that address's current token was issued.
const RESEND_COOLDOWN_MS = 60 * 1000;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (email && email.length <= 320 && EMAIL_RE.test(email)) {
    after(async () => {
      try {
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { email: true, name: true, hashedPassword: true },
        });
        if (!user) return;
        if (await hasRecentPasswordToken(user.email, RESEND_COOLDOWN_MS)) return;
        await issuePasswordEmail(user);
      } catch (err) {
        console.error("[request-reset] Failed to issue password email:", err);
      }
    });
  }

  return NextResponse.json(RESPONSE);
}
