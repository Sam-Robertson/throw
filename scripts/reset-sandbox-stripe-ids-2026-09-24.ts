// Run AFTER the Vercel Stripe keys are switched from the sandbox to live.
// Clears the Stripe ids on production that were created in the sandbox and
// that live mode cannot see, so the app recreates them on first use:
//   - Location.stripeTerminalLocationId (Provo's tml_… is a sandbox object;
//     Studio setup → Card readers recreates it in live mode)
//   - User.stripeCustomerId on accounts whose cus_… is a sandbox object
//     (checkout creates a live customer next time)
// Membership plan prices self-heal in live mode (src/lib/stripePrices.ts) and
// the four sandbox subscriptions belong to seed users, removed by
// scripts/remove-seed-data.ts. Dry run by default; --apply to write.
//
//   npx tsx --tsconfig tsconfig.json scripts/reset-sandbox-stripe-ids-2026-09-24.ts [--apply]
//
// Uses the Stripe key in the environment it runs with: run it with the LIVE
// key so "not visible" means "not a live object" (a customer the live key
// can retrieve is real and is kept).

import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function visible(fn: () => Promise<unknown>): Promise<boolean> {
  try { await fn(); return true; } catch (e) { if ((e as { code?: string }).code === "resource_missing") return false; throw e; }
}

async function main() {
  await stripe.balance.retrieve(); // proves the key works before anything is compared
  const live = process.env.STRIPE_SECRET_KEY!.startsWith("sk_live_");
  console.log(`Stripe key: ${live ? "LIVE" : "sandbox/test"}`);
  if (!live) console.log("warning: not a live key; this run only reports what the sandbox can see");

  const locs = await prisma.location.findMany({ where: { stripeTerminalLocationId: { not: null } }, select: { id: true, name: true, stripeTerminalLocationId: true } });
  const users = await prisma.user.findMany({ where: { stripeCustomerId: { not: null } }, select: { id: true, email: true, stripeCustomerId: true } });
  const clearLocs: string[] = [], clearUsers: string[] = [];
  for (const l of locs) {
    const ok = await visible(() => stripe.terminal.locations.retrieve(l.stripeTerminalLocationId!));
    console.log(`terminal ${l.name} ${l.stripeTerminalLocationId}: ${ok ? "visible, keep" : "not visible, clear"}`);
    if (!ok) clearLocs.push(l.id);
  }
  for (const u of users) {
    const ok = await visible(() => stripe.customers.retrieve(u.stripeCustomerId!));
    console.log(`customer ${u.email} ${u.stripeCustomerId}: ${ok ? "visible, keep" : "not visible, clear"}`);
    if (!ok) clearUsers.push(u.id);
  }
  if (!APPLY) { console.log(`dry run: would clear ${clearLocs.length} terminal id(s), ${clearUsers.length} customer id(s). Re-run with --apply.`); return; }
  if (!live) { console.log("refusing to write with a non-live key"); process.exitCode = 1; return; }
  const a = await prisma.location.updateMany({ where: { id: { in: clearLocs } }, data: { stripeTerminalLocationId: null } });
  const b = await prisma.user.updateMany({ where: { id: { in: clearUsers } }, data: { stripeCustomerId: null } });
  console.log(`cleared ${a.count} terminal id(s), ${b.count} customer id(s)`);
}
main().finally(() => prisma.$disconnect());
