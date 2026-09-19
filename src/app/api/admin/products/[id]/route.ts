import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseProductFields } from "../fields";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const current = await prisma.retailProduct.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = parseProductFields(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    data.name = body.name.trim();
  }

  // `archived` replaces delete: an archived product is off sale and hidden,
  // but every past order line still points at a real row.
  if (typeof body.archived === "boolean") {
    data.archivedAt = body.archived ? (current.archivedAt ?? new Date()) : null;
    if (body.archived) data.isActive = false;
  }

  // A product the catalog has no price for (OPEN) can't be switched on.
  const isPriced = data.isPriced ?? current.isPriced;
  const archived = data.archivedAt !== undefined ? data.archivedAt !== null : current.archivedAt !== null;
  if (data.isActive === true && (!isPriced || archived)) {
    return NextResponse.json(
      {
        error: archived
          ? "Restore this product before activating it."
          : "This product has no price yet. Set a price and mark it priced before activating it.",
      },
      { status: 400 },
    );
  }
  if (!isPriced) data.isActive = false;

  const product = await prisma.retailProduct.update({ where: { id }, data });
  return NextResponse.json(product);
}

/** Archives (never deletes): order history keeps pointing at the product. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const current = await prisma.retailProduct.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const product = await prisma.retailProduct.update({
    where: { id },
    data: { archivedAt: current.archivedAt ?? new Date(), isActive: false },
  });
  return NextResponse.json(product);
}
