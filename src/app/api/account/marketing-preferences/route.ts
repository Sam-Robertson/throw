import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizePhone, normalizeEmail, addSuppression, removeSuppression } from "@/lib/consent";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    smsMarketingOptIn?: boolean;
    emailMarketingOptIn?: boolean;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const data: {
    smsMarketingOptIn?: boolean;
    smsMarketingOptInAt?: Date;
    smsMarketingOptInSource?: string;
    emailMarketingOptIn?: boolean;
    emailMarketingOptInAt?: Date;
    emailMarketingOptInSource?: string;
  } = {};

  if (body.smsMarketingOptIn !== undefined) {
    data.smsMarketingOptIn = body.smsMarketingOptIn;
    if (body.smsMarketingOptIn) {
      data.smsMarketingOptInAt = now;
      data.smsMarketingOptInSource = "account_settings";
      if (user.phone) await removeSuppression("SMS", normalizePhone(user.phone));
    } else if (user.phone) {
      await addSuppression({
        channel: "SMS",
        value: normalizePhone(user.phone),
        reason: "USER_UNSUBSCRIBED",
        userId: user.id,
      });
    }
  }

  if (body.emailMarketingOptIn !== undefined) {
    data.emailMarketingOptIn = body.emailMarketingOptIn;
    if (body.emailMarketingOptIn) {
      data.emailMarketingOptInAt = now;
      data.emailMarketingOptInSource = "account_settings";
      await removeSuppression("EMAIL", normalizeEmail(user.email));
    } else {
      await addSuppression({
        channel: "EMAIL",
        value: normalizeEmail(user.email),
        reason: "USER_UNSUBSCRIBED",
        userId: user.id,
      });
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { smsMarketingOptIn: true, emailMarketingOptIn: true },
  });

  return NextResponse.json(updated);
}
