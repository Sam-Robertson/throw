import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const SLUG_RE = /^[a-z0-9-]+$/;

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pages = await prisma.landingPage.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(pages);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  if (!body.slug || !body.title || !body.headline || !body.ctaLabel || !body.ctaUrl) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!SLUG_RE.test(body.slug)) {
    return NextResponse.json(
      { error: "Slug must contain only lowercase letters, numbers, and hyphens" },
      { status: 400 },
    );
  }

  const existing = await prisma.landingPage.findUnique({
    where: { slug: body.slug },
  });
  if (existing) {
    return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
  }

  const page = await prisma.landingPage.create({
    data: {
      slug: body.slug,
      title: body.title,
      headline: body.headline,
      subheadline: body.subheadline || null,
      bodyHtml: body.bodyHtml || null,
      ctaLabel: body.ctaLabel,
      ctaUrl: body.ctaUrl,
      heroImageUrl: body.heroImageUrl || null,
      isActive: body.isActive ?? true,
      locationId: body.locationId || null,
    },
  });

  return NextResponse.json(page, { status: 201 });
}
