import { type NextRequest, NextResponse } from "next/server";
import { MembershipStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  forbiddenResponse,
  resolveLocationScope,
  scopeAllowsUnassigned,
} from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";
import { PlanInputError, parsePlanInput } from "../_lib/planInput";
import { NOT_VISIBLE, planInclude, syncStripePriceAfterSave } from "../_lib/planQuery";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await prisma.membershipPlan.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!scopeAllowsUnassigned(guard.scope, existing.locationId))
    return NextResponse.json(NOT_VISIBLE, { status: 403 });

  let data;
  try {
    data = parsePlanInput(body as Record<string, unknown>);
  } catch (err) {
    if (err instanceof PlanInputError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }

  if (data.locationId === null && existing.locationId !== null)
    return NextResponse.json({ error: "A plan can't be left without a studio" }, { status: 400 });

  // Moving a plan to another studio requires access to that studio.
  if (typeof data.locationId === "string" && data.locationId !== existing.locationId) {
    try {
      resolveLocationScope(guard.session, data.locationId);
    } catch (err) {
      return forbiddenResponse(err);
    }
  }

  const isLegacy = typeof data.isLegacy === "boolean" ? data.isLegacy : existing.isLegacy;
  const isPublic = typeof data.isPublic === "boolean" ? data.isPublic : existing.isPublic;
  if (isLegacy && isPublic)
    return NextResponse.json({ error: "A legacy plan can't be public" }, { status: 400 });

  // A plan's price is what its members pay. Members already subscribed stay on
  // their old Stripe Price, so changing it here would make the plan disagree
  // with their billing: archive the plan and create a new one instead.
  const priceChanged =
    (data.price !== undefined && data.price !== existing.price) ||
    (data.billingIntervalDays !== undefined &&
      data.billingIntervalDays !== existing.billingIntervalDays);
  if (priceChanged) {
    const activeCount = await prisma.membership.count({
      where: { planId: id, status: MembershipStatus.ACTIVE },
    });
    if (activeCount > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot change the price or interval of a plan with active members. Archive it and create a new plan.",
        },
        { status: 400 },
      );
    }
  }

  try {
    const plan = await prisma.membershipPlan.update({ where: { id }, data, include: planInclude });
    const stripeWarning = await syncStripePriceAfterSave(plan);
    return NextResponse.json({ ...plan, stripeWarning });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      return NextResponse.json({ error: "A plan with this slug already exists" }, { status: 409 });
    throw err;
  }
}
