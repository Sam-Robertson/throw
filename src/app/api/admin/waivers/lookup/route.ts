import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Who has signed: customers matching `q` (name or email) with every waiver
 * signature they hold, plus whether that signature is for the version of that
 * waiver currently in force. Lets the desk answer "has this
 * person signed?" without knowing which version they signed.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const users = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: 25,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      waiverSignatures: {
        orderBy: { signedAt: "desc" },
        select: {
          id: true,
          signedAt: true,
          typedName: true,
          source: true,
          signatureImageData: true,
          waiverVersion: {
            select: {
              id: true,
              version: true,
              isActive: true,
              location: { select: { id: true, name: true } },
              waiver: { select: { id: true, name: true, kind: true, archivedAt: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      signatures: u.waiverSignatures.map((s) => ({
        id: s.id,
        signedAt: s.signedAt,
        typedName: s.typedName,
        source: s.source,
        hasImage: s.signatureImageData !== null,
        signatureImageData: s.signatureImageData,
        version: s.waiverVersion.version,
        waiverId: s.waiverVersion.waiver?.id ?? null,
        waiverName: s.waiverVersion.waiver?.name ?? null,
        kind: s.waiverVersion.waiver?.kind ?? "CLASS",
        // Signed the version of that waiver that is in force today.
        isCurrent: s.waiverVersion.isActive && !s.waiverVersion.waiver?.archivedAt,
        locationId: s.waiverVersion.location?.id ?? null,
        locationName: s.waiverVersion.location?.name ?? null,
      })),
    })),
  );
}
