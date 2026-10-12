import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MembershipActionError, requestCancel } from "@/lib/membershipFreeze";

/** Ends a membership right now, commitment or not. */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  try {
    await requestCancel(id, { by: "admin", immediate: true, overrideCommitment: true });
    return NextResponse.json(await prisma.membership.findUnique({ where: { id } }));
  } catch (err) {
    if (err instanceof MembershipActionError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
