import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkDiscountFields, parseDiscountFields } from "../fields";

const INCLUDE = {
  sessionType: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
} as const;

// ── PATCH — edit any field, switch on/off, archive/restore ───────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const current = await prisma.discountCode.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The old Stripe-backed page sent { active }; keep that working.
  if (typeof body.active === "boolean" && body.isActive === undefined) body.isActive = body.active;

  const parsed = parseDiscountFields(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data: typeof parsed.data & { archivedAt?: Date | null } = parsed.data;

  const problem = checkDiscountFields({ ...current, ...data });
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if (data.code && data.code !== current.code) {
    // Redemptions and receipts name the code; renaming a used one rewrites history.
    if (current.usedCount > 0) {
      return NextResponse.json(
        { error: "This code has been used, so it can't be renamed. Archive it and create a new one." },
        { status: 409 },
      );
    }
    const taken = await prisma.discountCode.findUnique({ where: { code: data.code } });
    if (taken) return NextResponse.json({ error: "That code already exists" }, { status: 409 });
  }

  // `archived` replaces delete: redemptions keep pointing at a real row.
  if (typeof body.archived === "boolean") {
    data.archivedAt = body.archived ? (current.archivedAt ?? new Date()) : null;
    if (body.archived) data.isActive = false;
  }
  const archived = data.archivedAt !== undefined ? data.archivedAt !== null : current.archivedAt !== null;
  if (data.isActive === true && archived) {
    return NextResponse.json({ error: "Restore this discount before activating it." }, { status: 400 });
  }

  const discount = await prisma.discountCode.update({ where: { id }, data, include: INCLUDE });
  return NextResponse.json(discount);
}

/** Archives (never deletes): past redemptions keep pointing at the discount. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const current = await prisma.discountCode.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const discount = await prisma.discountCode.update({
    where: { id },
    data: { archivedAt: current.archivedAt ?? new Date(), isActive: false },
    include: INCLUDE,
  });
  return NextResponse.json(discount);
}
