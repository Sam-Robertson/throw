# Catalog audit

Audit of the codebase and the live data against `docs/throw-catalog.md`.
Written 2026-09-19 on branch `launch-sept-2026`. Database facts come from
read-only queries against the Neon database on that date.

Every later prompt reads this file first. Section 1 is the file map: use it
instead of re-exploring the repo.

---

## 1. File map

### Schema and migrations
| Path | What |
|---|---|
| `prisma/schema.prisma` | All models. `Location`, `MembershipPlan`, `Membership`, `MembershipCreditLedger`, `SessionType`, `StudioSession`, `Booking`, `Payment`, `RetailProduct`, `DiscountCode`, `GiftCard`, `PosOrder`, `PosOrderItem`, `PosPayment`, `PosCashDrawer` |
| `prisma/migrations/0_init` | Baseline. **Not yet marked applied on Neon** (no `_prisma_migrations` table there) |
| `prisma/migrations/20260913035634_launch-sept-2026` | Launch columns (`seriesId`, structured addresses, …). **Not yet applied on Neon** |
| `prisma/migrations/20260913120000_memberships-default-provo` | Assigns unassigned memberships to Provo. Not yet applied on Neon |
| `prisma/migrations/20260919180000_catalog-accuracy` | This work: additive catalog schema (section 6) |

There is no settings model: per-studio settings are columns on `Location`.

### Seeds and scripts
| Path | What |
|---|---|
| `prisma/seed.ts` | Dev/demo seed. Plan prices and `price_placeholder_*` Stripe ids are demo values |
| `scripts/momence-map.ts`, `scripts/momence-apply.ts` | The Momence import. One `SessionType` per distinct session *name*, price defaulting to $0 — the root cause of section 5 |
| `scripts/merge-session-types.ts` | Earlier merge pass (180 → 52 class types) |
| `scripts/promote-session-templates.ts` | Flags recurring types as templates |
| `scripts/cleanup-checkout-catalog.ts` | Superseded by `scripts/sync-class-types.ts` (Prompt 4) |
| `scripts/deactivate-unpayable-plans.ts` | Deactivated the imported plans with no Stripe price |
| `scripts/import-gift-cards.ts`, `scripts/import-waiver-signatures.ts` | Momence balance and waiver imports |
| `scripts/terminal-e2e.ts`, `scripts/verify-launch.ts` | Manual end-to-end checks |

### Admin pages
| Route | Path |
|---|---|
| Class Types | `src/app/admin/class-types/page.tsx` · API `src/app/api/admin/session-types/route.ts`, `[id]/route.ts` |
| Membership plans | `src/app/admin/membership-plans/page.tsx` · API `src/app/api/admin/membership-plans/route.ts`, `[id]/route.ts`, `[id]/toggle/route.ts` |
| Memberships (members list) | `src/app/admin/memberships/page.tsx` · API `src/app/api/admin/memberships/**` |
| Schedule | `src/app/admin/schedule/page.tsx` · API `src/app/api/admin/studio-sessions/**` |
| Studio Set-up › Locations | `src/app/admin/studio-setup/locations/page.tsx` · API `src/app/api/admin/locations/**` |
| Studio Set-up › Products | `src/app/admin/studio-setup/products/page.tsx` · API `src/app/api/admin/products/**` |
| Studio Set-up › Discount codes | `src/app/admin/studio-setup/discount-codes/page.tsx` · API `src/app/api/admin/discount-codes/**` (talks to **Stripe coupons**, not the `DiscountCode` table) |
| Studio Set-up › Gift cards | `src/app/admin/studio-setup/gift-cards/page.tsx` · API `src/app/api/admin/gift-cards/**` |
| Studio Set-up › Card readers | `src/app/admin/studio-setup/card-readers/page.tsx` · API `src/app/api/admin/terminal/**` |
| Customers | `src/app/admin/customers/page.tsx`, `[id]/page.tsx` · API `src/app/api/admin/customers/**` |
| Nav | `src/app/admin/_components/AdminNav.tsx` |

### POS
| Path | What |
|---|---|
| `src/app/admin/pos/page.tsx` | Server page |
| `src/app/admin/pos/_components/PosTerminal.tsx` | Root state: order lifecycle, location, header |
| `src/app/admin/pos/_components/CatalogPanel.tsx` | Tabs: retail, drop-ins, gift card, clay & firing, custom |
| `src/app/admin/pos/_components/FiringPanel.tsx` | Weigh-and-pay calculator |
| `src/app/admin/pos/_components/CartPanel.tsx` | Customer attach, lines, tip, totals, charge |
| `src/app/admin/pos/_components/PaymentSheet.tsx` | Tender sheet |
| `src/app/admin/pos/_components/TerminalPane.tsx` | Reader selection and polling |
| `src/app/admin/pos/_components/types.ts` | POS DTOs, `formatMoney` |
| `src/app/admin/pos/orders/**`, `src/app/admin/pos/drawer/**` | Order history; cash drawer (unlinked — the studio takes no cash) |
| `src/app/api/pos/catalog/route.ts` | Catalog for the current studio |
| `src/app/api/pos/orders/route.ts`, `[id]/route.ts`, `[id]/items/route.ts`, `[id]/items/[itemId]/route.ts`, `[id]/void/route.ts`, `[id]/receipt/route.ts` | Orders and lines |
| `src/app/api/pos/orders/[id]/payments/{card-terminal,card-manual,gift-card,comp,cash}/route.ts`, `[paymentId]/{confirm,terminal-status,terminal-cancel}/route.ts` | Tenders |
| `src/app/api/pos/readers/route.ts` | Readers at a studio |
| `src/lib/pos.ts` | Totals, `repriceOrder`, `checkOrderPayable`, gift card issue, `maybeCompletePosOrder` |
| `src/lib/terminal.ts`, `src/lib/stripeTax.ts` | Stripe Terminal and Stripe Tax |
| `src/lib/sellable.ts` | **Single place** that decides whether a class is for sale and what it costs at a studio |
| `src/config/firingPrices.ts`, `src/config/taxCodes.ts` | Hardcoded firing price book and tax codes |

### Stripe Products / Prices
No code creates Stripe Products or Prices. `MembershipPlan.stripePriceId` is typed by
hand in admin. Referenced in `src/app/api/memberships/{subscribe,resume,change-plan}/route.ts`
and `src/app/api/admin/membership-plans/**`. Class bookings, tips and the preorder
widget use inline `price_data` or a price id sent by the widget
(`src/app/api/preorder/checkout/route.ts`). Subscriptions are touched in
`src/app/api/memberships/{pause,cancel,resume,change-plan}`, `src/app/api/admin/memberships/[id]/{pause,cancel}`,
`src/app/api/account/route.ts` and `src/app/api/webhooks/stripe/route.ts`.

### Customer-facing surfaces
`src/app/(public)/membership/page.tsx` (DB-driven plans), `src/app/(public)/schedule/**`
(DB), `src/app/(customer)/book/[id]/**` (DB), `src/app/(customer)/membership/**` (DB),
`src/app/(public)/page.tsx` + `src/app/(public)/classes/[slug]/page.tsx` (copy from
`src/content/site.ts`, `src/content/classes.ts`).

### Tests
There was no test runner and no tests. Prompt 5 adds one for the firing function.

---

## 2. Matches

| Item | Value | Where |
|---|---|---|
| Lehi Kickstart | $200 | `SessionType` `lehi-beginner-pottery-kickstart` |
| Class pack prices | 5/$150, 10/$270, 15/$360 | present as **inactive Momence membership plans**, right numbers, wrong model |
| Guest pass | $25 / month | inactive Momence plan `guest-pass-458163` (28 active holders), right number, wrong model |
| Piece prices | $9.99 / $12.99 / $14.99 | `src/config/firingPrices.ts` `EXPERIENCE_BANDS` (hardcoded, not data) |
| Member firing rates | $1.00 and $1.75 per lb | `src/config/firingPrices.ts` (hardcoded) |
| Gift cards never expire | `expiresAt` null on issue | `src/lib/pos.ts` |
| Tax by Stripe Tax only | yes | `src/lib/stripeTax.ts`; nothing computes tax by hand |
| Memberships not sold in POS | tab removed | `CatalogPanel.tsx` |
| Standard plan numbers in the dev seed | $70/8, $90→ see mismatch, $120/12 | `prisma/seed.ts` |

## 3. Mismatches

| Item | Current | Catalog | Where |
|---|---|---|---|
| Clay Together, Lehi | $29.99 | $35.00 | `SessionType` `lehi-clay-together-pottery-wheel-experience` |
| Clay Together, Provo | $0 | $29.99 | `SessionType` `provo-clay-together-pottery-wheel-experience` (1,213 sessions) |
| Kickstart, Provo | $0 | $200 | `SessionType` `beginner-pottery-kickstart` (322 sessions) |
| Lehi After-School | $325, named "(12-18) (Oct 7-Nov 11)" | $257, ages 8–17 | `SessionType` `after-school-classes-12-18-oct-7-nov-11` |
| Active public plans | Annual $899, Open Studio Monthly $89, Studio Plus $149 (dev seed rows) + Pro 3-Month $90 | Basic $70, Pro $110, Expert $120 | `MembershipPlan` |
| Pro monthly price | $90 on every Momence Pro plan | $110 standard; $90 is **Pro Legacy** | `MembershipPlan` |
| Plan ticket counts | null (= unlimited) on all 56 plans | 8 / 10 / 12 | `MembershipPlan.classTicketsPerPeriod` |
| Joining fee | 0 everywhere | $25 month-to-month, waived on 3 and 12 month | `MembershipPlan.joiningFeeCents` |
| Retail discount | 0 everywhere, and never applied by any code | 10% / 20% by commitment | `MembershipPlan.retailDiscountPercent`, `src/lib/pos.ts` |
| Extra clay / clay | recycled clay $0.50/lb only | extra clay $3.00/lb, B-Mix $1.00/lb | `src/config/firingPrices.ts` |
| Firing minimum | none | $1.00 per piece | `src/config/firingPrices.ts` |
| Firing rounding | total weight in ounces, one line | per piece, 0.1 lb, round to cent, then minimum | `quoteFiring` |
| Kickstart clay allowance | 15 lb in `firingPrices.ts`, 10 lb in `classes.ts` | 10 lb (site) | both files |
| Marketing copy, drop-in | "$40 + $8-12 per piece", "$40 … $10 at pickup" | $29.99 / $35 per wheel + $9.99–$14.99 per piece | `src/content/site.ts:48`, `src/content/classes.ts:180,232` |
| POS tenders | cash offered | no cash | fixed in `0511be4` |
| POS studio picker | full studio names | Provo / Lehi | fixed in `0511be4` |

## 4. Missing

- Standard Basic / Pro / Expert plans for each studio; Lehi founding plans and their cap; legacy plans as first-class rows; commitment terms; guest pass add-on; freeze policy.
- Class types: Guided Pottery Time (exists as "Guided Pottery Time - Members"), Kids Summer Camp, Group Event / Private Booking, Workshop, Private Lesson as clean single types; Lehi Homeschool course.
- Every product: piece charges, handle, glazed by us, extra clay, member firing, clay, class packs, shipping. `RetailProduct` has **0 rows**.
- Every discount. `DiscountCode` has **0 rows** and no application code reads the table.
- Class pack credits (no model). Account credit (no field).
- POS: order-level and named discounts, automatic member discounts, per-line notes, parked orders, walk-in name and phone, quick piece buttons, per-piece firing calculator.
- A test runner.

## 5. Extra or stale

Live `SessionType` rows: 52, all active, 45 at $0. Origin of each entry named in the brief:

| Entry | Where it comes from | What it is |
|---|---|---|
| "90 Min Pottery Class" | Momence session name, 5 sessions in June 2025 | Stale; the experience is 120 min. Archive |
| "August - 4 Week Course - Aug 2,9,16,23 @ 12pm" | Momence: cohort dates embedded in the event name; `momence-map.ts` makes one type per name | A Kickstart cohort. Merge into Pottery Kickstart |
| "4 Week Course", "Beginner Pottery Kickstart", "Clay Together - 4 Week Beginner Pottery Wheel Course - Provo", "Intermediate Pottery Kickstart" | Same course renamed over time in Momence | Merge into Pottery Kickstart |
| "August Back-To-You Mom Reset - (Thursday's @ 7:00 pm, …)" | Momence one-off themed 4-week cohort, Aug 2026 | Past. Archive |
| "Bree Goates - Kid's birthday parties", "Meredith's Group", "McKenzie Guymon Private Group", "Keyla bachelorette party", "Private Class with Lexi", four "July - Summer Camp … (Private Event)" | Momence private bookings stored as events | Group Event / Private Booking sessions. Archive the types; upcoming sessions move to Group Event |
| "Busy Window" | `prisma/seed.ts` (`isBusyWindow: true`, $20). Marks hours when members' open studio is restricted | Internal block. Never sellable: excluded by `SELLABLE_SESSION_TYPE.isBusyWindow` |
| "Free Pottery Wheel Experience - Provo" | Momence $0 event used to honour a coupon | A coupon, not a class. Archive; discount created in Prompt 5 |
| "Pay for Pottery Pieces" (293 upcoming), "Pottery Piece Pick Up!" (1,131 past) | Momence used bookable $0 events as a payment and pick-up mechanism | Replaced by the POS Pieces tab and piece intake. Archive |
| "Studio Tour", "Orem Farmers Market", "Grand 2nd Year Birthday Party…", "Members-Giving!", "Member + Friends Halloween Pottery Night!", "Spooky Clay Night", "Valentines Day Experience" | Momence one-off events | Archive |
| 31 workshops merged earlier into "General Workshop" | `merge-session-types.ts` | Becomes Workshop |
| "Wheel Throwing 101" $45, "Open Studio" $15, "Hand Building Workshop" $40 | `prisma/seed.ts` demo rows that reached the live database | Not offered. Archive |
| "Group Pottery Wheel Event", "Group Pottery Wheel Experience", "Kids Camp Group Wheel Event" | Momence group bookings | Merge into Group Event / Private Booking |
| "Summer Kids Camp" (171 sessions) | merged Momence camps | Becomes Kids Summer Camp |
| "Private Lesson/Tutoring" | Momence appointment service | Becomes Private Lesson |

Why the POS showed all of them at $0.00: on `main` the Drop-ins tab renders one tile
per active `SessionType` (`catalog.sessionTypes`), and the import priced them at $0.
On this branch the tab lists sessions, and `src/lib/sellable.ts` filters them.

Membership plans: 56 rows. The 52 inactive Momence rows are history and keep their
members (308 active memberships point at them); 3 of the 4 active rows are dev-seed
plans with placeholder Stripe prices.

## 6. Schema gaps

All closed by `prisma/migrations/20260919180000_catalog-accuracy` (additive only:
9 new tables, 53 new columns, no drops, renames or type changes; every NOT NULL
column has a default).

| Gap | Closed by |
|---|---|
| Per-location class price | `SessionTypeLocationPrice` (+ `isConfirmed`), resolved in `src/lib/sellable.ts` |
| Class type kind, tags, price unit, people per wheel, wheel sharing, ticket eligible, public/private, members only, member price, ages, archive | new columns on `SessionType` |
| Price and ticket eligibility per session (workshops), session title | `StudioSession.priceCentsOverride`, `isTicketEligibleOverride`, `title` |
| Wheels per booking | `Booking.quantity` |
| Plans: public, legacy, founding, tier, needs-confirmation, forfeits rate, archive | new columns on `MembershipPlan` |
| Founding cap shared across tiers | `MembershipCapGroup` + `MembershipPlan.capGroupId` |
| Commitment terms independent of tier | `CommitmentTerm` + `Membership.commitmentTermId` |
| Add-ons (guest pass) | `MembershipAddOn`, `MembershipAddOnAssignment` |
| Freeze fee, credit accrual, forfeits founding rate | `FreezePolicy` (nullable amounts = OPEN) |
| Products with category, unit (each / lb), minimum charge, members-only, no-stock, class credits, tax code, not-yet-priced | new columns on `RetailProduct` |
| Oversize firing rate | a second by-weight product with its own rate and minimum |
| Class pack credits | `ClassCreditLedger` |
| Discount scope, how applied, per-customer yearly limit, note required, group-event only, product / class limit, unit cap | new columns on `DiscountCode`; uses in `DiscountRedemption` |
| Named order discounts, line notes, line category | `PosOrderDiscount`, `PosOrderItem.note`, `PosOrderItem.category` |
| Walk-in name and phone, parked orders | `PosOrder.walkInName`, `walkInPhone`, `parkedAt` |
| Account credit | `User.accountCreditCents` |

Per-location plan prices need no change: a plan row already belongs to one studio.

## 7. Hardcoded values

| File:line | Value | Meaning |
|---|---|---|
| `src/config/firingPrices.ts:26-27` | 100, 175 | member firing ¢/lb |
| `src/config/firingPrices.ts:37-39` | 999 / 1299 / 1499 | piece prices by weight band |
| `src/config/firingPrices.ts:49` | 15 lb | Kickstart allowance (site says 10 lb) |
| `src/config/firingPrices.ts:55-56` | 50 ¢/lb, bag sizes | recycled clay |
| `src/config/taxCodes.ts:15-25` | `txcd_99999999`; drop-ins, memberships, gift cards non-taxable | tax codes per item type |
| `src/app/admin/pos/_components/CatalogPanel.tsx:26` | $25 / $50 / $100 | gift card presets |
| `src/app/admin/pos/_components/CartPanel.tsx:57` | $1 / $2 / $5 | POS tip presets |
| `src/lib/terminal.ts:22` | 15 / 18 / 20 % | on-reader tip options |
| `src/app/api/pos/catalog/route.ts:13`, `CatalogPanel.tsx:27` | 7 | days of sessions listed |
| `src/app/api/pos/orders/[id]/void/route.ts:8`, `OrderHistoryClient.tsx:143` | 24 h | void grace period |
| `src/lib/credits.ts:166,191` | 1 | tickets per booking |
| `src/app/api/tips/route.ts:6-7`, `TipForm.tsx:10-13` | $1 min, $100 max, $3/$5/$10/$20 | customer tips |
| `src/app/(public)/membership/page.tsx:47-48,53` | shelf sizes; "/mo" | plan table copy |
| `src/content/site.ts:17,48,56,67,79` | "40% off", "$40 + $8-12", "$200", "from $70", "groups of 8+" | home page copy |
| `src/content/classes.ts:180,232,239,282,354,357` | $40/$10/$50, $29.99/$10, $100/$80/$20, $375, $200, 10 lb | class page copy |
| `src/app/api/admin/discount-codes/route.ts:46` | `duration: "once"` | every Stripe coupon single use |
| `src/app/admin/studio-setup/gift-cards/page.tsx:50` vs `src/lib/pos.ts:240` | two different code alphabets | gift card codes |
| `src/app/api/preorder/checkout/route.ts:30-48` | placeholder page slugs, max quantity 20 | Lehi preorder widget |
| `prisma/seed.ts:227-396,728-747` | demo plan and class prices, `price_placeholder_*` | dev seed only |

## 8. OPEN items for the client

See `docs/throw-catalog.md` section 9. In short: Lehi standard membership prices;
ticket rollover; tickets and shelf for legacy plans; freeze fee and credit; price
for a piece over 2 lb; Speckled Buff, Charcoal, bag and sample pack prices;
shipping for 5+ pieces; durations for Guided Pottery Time, Group Event and Private
Lesson; whether the Lehi After-School and Homeschool courses stay in the catalog
and take tickets; GRAND30 dates and scope; Summer Camp ages (8–17 vs 10–17 on the
site); what Kickstart students pay past their clay allowance.
