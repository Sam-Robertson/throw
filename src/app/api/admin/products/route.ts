import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_TAX_CODES, isProductCategory } from "@/config/taxCodes";
import { parseProductFields, uniqueProductSlug } from "./fields";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Archived products are included (the page hides them behind a toggle).
  const products = await prisma.retailProduct.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  // In catalog order, with the tax code each product will actually be sold with.
  const rank = (category: string) => {
    const i = (PRODUCT_CATEGORIES as readonly string[]).indexOf(category);
    return i === -1 ? PRODUCT_CATEGORIES.length : i;
  };
  return NextResponse.json(
    products
      .sort((a, b) => rank(a.category) - rank(b.category))
      .map((p) => ({
        ...p,
        effectiveTaxCode: p.taxCode ?? (isProductCategory(p.category) ? PRODUCT_CATEGORY_TAX_CODES[p.category] : null),
      })),
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const parsed = parseProductFields(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  // A product with no price yet can't be on sale.
  const isPriced = data.isPriced ?? true;
  const product = await prisma.retailProduct.create({
    data: {
      ...data,
      name: body.name.trim(),
      priceCents: data.priceCents ?? 0,
      isPriced,
      isActive: isPriced ? (data.isActive ?? true) : false,
      slug: await uniqueProductSlug(body.name),
    },
  });

  return NextResponse.json(product, { status: 201 });
}
