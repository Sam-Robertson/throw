import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { role: "CUSTOMER" | "STAFF" | "ADMIN" };

  if (!["CUSTOMER", "STAFF", "ADMIN"].includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Prevent demoting yourself
  if (session.user.id === id && body.role !== "ADMIN") {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role: body.role },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(user);
}
