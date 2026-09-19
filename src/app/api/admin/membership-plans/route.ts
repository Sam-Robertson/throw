import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  forbiddenResponse,
  locationWhereOrUnassigned,
  resolveLocationScope,
} from "@/lib/locationScope";
import { requireStaffScope } from "@/lib/staffScope";
import { PlanInputError, parsePlanInput } from "./_lib/planInput";
import { planInclude, syncStripePriceAfterSave, withCapUsage } from "./_lib/planQuery";

export async function GET(req: NextRequest) {
  const guard = await requireStaffScope(req.nextUrl.searchParams.get("locationId"));
  if (guard.error) return guard.error;

  // Imported Momence plans have no studio, so they stay visible to every
  // scope, the same way their memberships do (membershipScopeWhere).
  const plans = await prisma.membershipPlan.findMany({
    where: locationWhereOrUnassigned(guard.scope),
    orderBy: [{ locationId: "asc" }, { isFounding: "asc" }, { price: "asc" }],
    include: planInclude,
  });

  return NextResponse.json(await withCapUsage(plans));
}

export async function POST(req: NextRequest) {
  const guard = await requireStaffScope();
  if (guard.error) return guard.error;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  let data;
  try {
    data = parsePlanInput(body as Record<string, unknown>);
  } catch (err) {
    if (err instanceof PlanInputError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }

  const { name, slug, price, billingIntervalDays, locationId } = data;
  if (
    typeof name !== "string" ||
    typeof slug !== "string" ||
    typeof price !== "number" ||
    typeof billingIntervalDays !== "number" ||
    typeof locationId !== "string"
  )
    return NextResponse.json(
      { error: "Name, slug, price, billing interval and studio are required" },
      { status: 400 },
    );
  if (data.isLegacy === true && data.isPublic !== false)
    return NextResponse.json({ error: "A legacy plan can't be public" }, { status: 400 });

  // STAFF may only create plans for a studio they're assigned to.
  try {
    resolveLocationScope(guard.session, locationId);
  } catch (err) {
    return forbiddenResponse(err);
  }

  try {
    const plan = await prisma.membershipPlan.create({
      data: { ...data, name, slug, price, billingIntervalDays, locationId },
      include: planInclude,
    });
    const stripeWarning = await syncStripePriceAfterSave(plan);
    return NextResponse.json({ ...plan, stripeWarning }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      return NextResponse.json({ error: "A plan with this slug already exists" }, { status: 409 });
    throw err;
  }
}
