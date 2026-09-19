import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateGiftCardCode, giftCardCodeCandidates } from "@/lib/giftCardCode";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const giftCards = await prisma.giftCard.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(giftCards);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    code?: string;
    initialCents?: number;
    locationId?: string;
  } | null;

  // Any amount: gift cards aren't limited to the preset values.
  if (!body || typeof body.initialCents !== "number" || !Number.isInteger(body.initialCents) || body.initialCents <= 0) {
    return NextResponse.json({ error: "initialCents must be a whole number of cents greater than 0" }, { status: 400 });
  }

  // A blank code is generated here, from the same alphabet the POS uses.
  const code = (body.code?.trim().toUpperCase() || generateGiftCardCode()).replace(/\s+/g, "");
  if (!/^[A-Z0-9][A-Z0-9-]{3,39}$/.test(code)) {
    return NextResponse.json({ error: "Code must be 4–40 letters, numbers or dashes" }, { status: 400 });
  }

  const existing = await prisma.giftCard.findFirst({ where: { code: { in: giftCardCodeCandidates(code) } } });
  if (existing) return NextResponse.json({ error: "Code already exists" }, { status: 409 });

  // Gift cards never expire (docs/throw-catalog.md §5), so none is set.
  const giftCard = await prisma.giftCard.create({
    data: {
      code,
      initialCents: body.initialCents,
      balanceCents: body.initialCents,
      expiresAt: null,
      locationId: body.locationId ?? null,
    },
  });

  return NextResponse.json(giftCard, { status: 201 });
}
