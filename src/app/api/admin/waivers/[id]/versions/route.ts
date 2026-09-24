import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText, isRichTextEmpty } from "@/lib/richText";
import { WAIVER_ADMIN_SELECT } from "../../_shared";

/**
 * Publishes a new version of one waiver. The previous version stays on file
 * (its signatures remain valid for what they signed) but stops being current,
 * so anyone who hasn't signed the new text is asked to.
 * Body: `{ content }`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  const content = typeof body?.content === "string" ? sanitizeRichText(body.content) : "";
  if (!content || isRichTextEmpty(content))
    return NextResponse.json({ error: "Content is required" }, { status: 400 });

  const waiver = await prisma.waiver.findUnique({
    where: { id },
    select: { id: true, locationId: true, archivedAt: true },
  });
  if (!waiver) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (waiver.archivedAt)
    return NextResponse.json({ error: "Restore this waiver before publishing a new version" }, { status: 409 });

  const latest = await prisma.waiverVersion.findFirst({
    where: { waiverId: id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.waiverVersion.updateMany({
      where: { waiverId: id, isActive: true },
      data: { isActive: false },
    });
    await tx.waiverVersion.create({
      data: {
        waiverId: id,
        locationId: waiver.locationId,
        content,
        version: nextVersion,
        publishedAt: new Date(),
        isActive: true,
      },
    });
    return tx.waiver.findUniqueOrThrow({ where: { id }, select: WAIVER_ADMIN_SELECT });
  });

  return NextResponse.json(updated, { status: 201 });
}
