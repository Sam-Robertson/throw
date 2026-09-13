import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { locationWhereOrUnassigned } from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";

// Sidebar badge: unread across everything this user may see (their whole
// scope, not the switcher's current selection — the badge is global).
export async function GET() {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const result = await prisma.conversation.aggregate({
    where: locationWhereOrUnassigned(guard.scope),
    _sum: { adminUnread: true },
  });

  return NextResponse.json({ count: result._sum.adminUnread ?? 0 });
}
