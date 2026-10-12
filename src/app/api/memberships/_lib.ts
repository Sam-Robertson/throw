import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MembershipActionError } from "@/lib/membershipFreeze";

/** The signed-in customer's current (active or paused) membership. */
export async function currentMembership() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true },
  });
  if (!membership)
    return { error: NextResponse.json({ error: "No active or paused membership found" }, { status: 404 }) };
  return { membership, session };
}

export function actionError(err: unknown): NextResponse {
  if (err instanceof MembershipActionError)
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  console.error("[memberships]", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
