import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkDiscountFields, parseDiscountFields } from "./fields";

/**
 * Discounts live in the DiscountCode table (docs/throw-catalog.md §6), not in
 * Stripe coupons: the POS and online class checkout price them through
 * src/lib/discounts.ts. (The Lehi preorder widget still takes Stripe promotion
 * codes; those are managed in the Stripe dashboard.)
 */

// ── GET — every discount, plus the pick lists the form needs ──────────────
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [discounts, sessionTypes, products, locations] = await Promise.all([
    // Archived discounts are included (the page hides them behind a toggle).
    prisma.discountCode.findMany({
      include: {
        sessionType: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: [{ appliesVia: "asc" }, { code: "asc" }],
    }),
    prisma.sessionType.findMany({
      where: { isActive: true, archivedAt: null, isBusyWindow: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.retailProduct.findMany({
      where: { slug: { not: null }, archivedAt: null },
      select: { slug: true, name: true, category: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.location.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({ discounts, options: { sessionTypes, products, locations } });
}

// ── POST — create a discount ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const parsed = parseDiscountFields(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  if (!data.code) return NextResponse.json({ error: "Code is required" }, { status: 400 });
  if (data.value === undefined) return NextResponse.json({ error: "Value is required" }, { status: 400 });

  const row = {
    type: data.type ?? "percent",
    value: data.value,
    appliesVia: data.appliesVia ?? "CODE",
    autoCommitmentMonths: data.autoCommitmentMonths ?? null,
    validFrom: data.validFrom ?? null,
    validUntil: data.validUntil ?? null,
  };
  const problem = checkDiscountFields(row);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const existing = await prisma.discountCode.findUnique({ where: { code: data.code } });
  if (existing) {
    return NextResponse.json(
      { error: existing.archivedAt ? "That code exists but is archived. Restore it instead." : "That code already exists" },
      { status: 409 },
    );
  }

  const discount = await prisma.discountCode.create({
    data: { ...data, ...row, code: data.code },
    include: {
      sessionType: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(discount, { status: 201 });
}
