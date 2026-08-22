import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyUnsubscribeToken,
  normalizePhone,
  normalizeEmail,
  addSuppression,
} from "@/lib/consent";

function errorPage() {
  return new NextResponse(
    `<!doctype html>
<html>
<head><title>Unsubscribe link invalid</title></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; text-align: center; color: #333;">
  <h1>This link is no longer valid</h1>
  <p>The unsubscribe link you used is invalid or expired. Please contact the studio directly if you'd like to update your communication preferences.</p>
</body>
</html>`,
    { status: 400, headers: { "Content-Type": "text/html" } },
  );
}

async function applyUnsubscribe(userId: string, channel: "SMS" | "EMAIL") {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  if (channel === "EMAIL") {
    await prisma.user.update({
      where: { id: userId },
      data: { emailMarketingOptIn: false },
    });
    await addSuppression({
      channel: "EMAIL",
      value: normalizeEmail(user.email),
      reason: "USER_UNSUBSCRIBED",
      userId,
    });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { smsMarketingOptIn: false },
    });
    if (user.phone) {
      await addSuppression({
        channel: "SMS",
        value: normalizePhone(user.phone),
        reason: "USER_UNSUBSCRIBED",
        userId,
      });
    }
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const decoded = token ? verifyUnsubscribeToken(token) : null;
  if (!decoded) return errorPage();

  await applyUnsubscribe(decoded.userId, decoded.channel);

  return NextResponse.redirect(
    new URL(`/unsubscribed?channel=${decoded.channel.toLowerCase()}`, req.url),
  );
}

// RFC 8058 one-click unsubscribe — no auth, no CSRF check; called by mail clients.
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const decoded = token ? verifyUnsubscribeToken(token) : null;
  if (!decoded) return new NextResponse(null, { status: 400 });

  await applyUnsubscribe(decoded.userId, decoded.channel);

  return new NextResponse(null, { status: 200 });
}
