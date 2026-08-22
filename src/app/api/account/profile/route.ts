import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/consent";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    name?: string;
    phone?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: body.name.trim(),
      phone: body.phone?.trim() ? normalizePhone(body.phone.trim()) : null,
      emergencyContactName: body.emergencyContactName?.trim() || null,
      emergencyContactPhone: body.emergencyContactPhone?.trim() || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json(updated);
}
