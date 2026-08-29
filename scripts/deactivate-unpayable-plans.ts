// One-time cleanup: the Momence import brought in 53 legacy membership
// plans, none of which have a stripePriceId. The subscribe route
// (src/app/api/memberships/subscribe/route.ts) hard-requires stripePriceId
// and returns "Plan not configured for payments" without one — so every one
// of these plans is already non-functional for new signups, regardless of
// isActive. They were flooding the public homepage/membership page as if
// they were real options. This deactivates exactly that set (does not
// touch the 3 original seed plans, which do have a stripePriceId).
//
// Existing customers on a deactivated plan are unaffected — isActive only
// controls whether a plan is offered to new signups; their own Membership
// row's status is what gates their actual access.
//
// Always prints the plan. Pass --apply to actually write.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const targets = await prisma.membershipPlan.findMany({
    where: { stripePriceId: null, isActive: true },
    include: { _count: { select: { memberships: true } } },
    orderBy: { name: "asc" },
  });

  console.log(`${targets.length} active plans have no stripePriceId (unpayable):`);
  for (const p of targets) {
    console.log(`  "${p.name}" — ${p._count.memberships} existing membership(s) on it, unaffected`);
  }

  if (APPLY) {
    const { count } = await prisma.membershipPlan.updateMany({
      where: { id: { in: targets.map((p) => p.id) } },
      data: { isActive: false },
    });
    console.log(`\nDeactivated ${count} plans.`);
  } else {
    console.log(`\nDry run only — re-run with --apply to write these changes.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
