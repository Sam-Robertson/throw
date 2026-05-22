import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const SLUG_RE = /^[a-z0-9-]+$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const page = await prisma.landingPage.findUnique({ where: { id } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(page);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    slug?: string;
    title?: string;
    headline?: string;
    subheadline?: string;
    bodyHtml?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    heroImageUrl?: string;
    isActive?: boolean;
    locationId?: string;
  };

  if (body.slug !== undefined) {
    if (!SLUG_RE.test(body.slug)) {
      return NextResponse.json(
        { error: "Slug must contain only lowercase letters, numbers, and hyphens" },
        { status: 400 },
      );
    }
    const conflict = await prisma.landingPage.findFirst({
      where: { slug: body.slug, NOT: { id } },
    });
    if (conflict) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }
  }

  const updated = await prisma.landingPage.update({
    where: { id },
    data: {
      ...(body.slug !== undefined && { slug: body.slug }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.headline !== undefined && { headline: body.headline }),
      ...(body.subheadline !== undefined && { subheadline: body.subheadline || null }),
      ...(body.bodyHtml !== undefined && { bodyHtml: body.bodyHtml || null }),
      ...(body.ctaLabel !== undefined && { ctaLabel: body.ctaLabel }),
      ...(body.ctaUrl !== undefined && { ctaUrl: body.ctaUrl }),
      ...(body.heroImageUrl !== undefined && { heroImageUrl: body.heroImageUrl || null }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.locationId !== undefined && { locationId: body.locationId || null }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.landingPage.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
