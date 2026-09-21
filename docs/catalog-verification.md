# Catalog verification (Prompt 7)

Checked 2026-09-21 on branch `launch-sept-2026`. Read-only pass: nothing was fixed.
Source of truth: `docs/throw-catalog.md`. File map and earlier results: `docs/catalog-audit.md`.

## 0. What this was checked against

- **Every database value below comes from the local rehearsal database**
  `postgresql://samrobertson@localhost:5432/throw_rehearsal`, SELECTs only. It is a copy of
  production's class types and sessions with all four migrations applied
  (`0_init`, `launch-sept-2026`, `memberships-default-provo`, `catalog-accuracy`) and the three
  sync scripts run with `--apply`: `scripts/sync-membership-plans.ts` (`npm run sync:plans`),
  `scripts/sync-class-types.ts` (`npm run catalog:sync-class-types`), then
  `scripts/sync-products.ts` (`npm run sync:products`). Class types must run before products.
- **The same scripts are what run on production**, so the rows they create will be the same there.
  What they *find* there will not be: see the limits below.
- **Production was not touched or read.** The `.env` database was never used.
- **Production must be spot-checked after the sync scripts run there.** Queries in 0.2.

### 0.1 Limits of the rehearsal copy

| Rehearsal has | Production has | So this could not be verified here |
|---|---|---|
| 12 membership plans (only the rows the sync creates) | 56 plans, 52 of them imported from Momence | That the 4 old public plans (`annual-membership`, `open-studio-monthly`, `studio-plus-monthly`, `pro-3-month-commitment-membership-726002`) get retired and every Momence plan gets `isPublic=false, isLegacy=true` |
| 0 `Membership` rows | 308+ active memberships | That no customer membership is touched; the founding cap count; the automatic 10% / 20% member discount against a real member |
| 0 gift cards, 0 POS orders, 0 retail (shelf) products | imported gift cards | Gift card import expiry values |
| `Location` rows with no address and no `stripeTerminalLocationId` (both studios) | unknown | Stripe Tax needs the studio address (`src/lib/stripeTax.ts:56` returns $0 tax with a warning without one); card readers need the Terminal Location |
| 5,055 sessions, 10,779 bookings, 3,613 users, 61 class types | same source | Class type results should carry over |

### 0.2 Production spot-check (run after the three scripts, SELECT only)

```sql
-- 1. Class types: expect 61 total, 17 active, 44 archived, 0 both
select count(*) total, count(*) filter (where "isActive") active,
       count(*) filter (where "archivedAt" is not null) archived,
       count(*) filter (where "isActive" and "archivedAt" is not null) both
from "SessionType";

-- 2. Per-studio class prices: expect clay-together 2999 Provo / 3500 Lehi, pottery-kickstart 20000 both,
--    lehi-after-school-course and lehi-homeschool-course 25700 Lehi
select st.slug, l.name, p."priceCents", p."isConfirmed"
from "SessionTypeLocationPrice" p join "SessionType" st on st.id = p."sessionTypeId"
join "Location" l on l.id = p."locationId" order by 1, 2;

-- 3. Anything a customer could be offered at $0: expect exactly one row, workshop (priced per session)
select st.slug from "SessionType" st
where "isActive" and "archivedAt" is null and "isPublic" and not "membersOnly" and not "isBusyWindow"
  and "dropInPriceCents" = 0
  and not exists (select 1 from "SessionTypeLocationPrice" p where p."sessionTypeId" = st.id);

-- 4. Plans a customer can buy: expect exactly 9 (provo-/lehi- basic, pro, expert + 3 lehi-founding-*)
select slug, price, "classTicketsPerPeriod", "shelfType", "joiningFeeCents", "isFounding", "priceNeedsConfirmation"
from "MembershipPlan"
where "isActive" and "isPublic" and not "isLegacy" and "archivedAt" is null order by slug;

-- 5. Old plans retired and members untouched: expect the 4 old slugs not purchasable,
--    and the membership count equal to the count taken BEFORE the sync
select slug, "isActive", "isPublic", "isLegacy", "archivedAt" from "MembershipPlan"
where slug in ('annual-membership','open-studio-monthly','studio-plus-monthly','pro-3-month-commitment-membership-726002');
select status, count(*) from "Membership" group by 1;

-- 6. Founding cap and how many seats are used: expect cap 50
select g.slug, g.cap, count(m.id) filter (where m.status in ('ACTIVE','PAUSED')) sold
from "MembershipCapGroup" g left join "MembershipPlan" p on p."capGroupId" = g.id
left join "Membership" m on m."planId" = p.id group by 1, 2;

-- 7. Commitment terms, add-on, freeze policy: expect $25 / 0 / 0 fees, 0 / 10 / 20 %, freeMonths 0 / 0 / 1;
--    guest-pass 2500; freeze amounts NULL at both studios
select slug, months, "joiningFeeCents", "retailDiscountPercent", "includesGuestPass", "includesVideoLibrary", "freeMonths" from "CommitmentTerm" order by "sortOrder";
select slug, "priceCents", "isActive" from "MembershipAddOn";
select l.name, f."monthlyFeeCents", f."creditCentsPerFrozenMonth", f."forfeitsFoundingRate" from "FreezePolicy" f join "Location" l on l.id = f."locationId";

-- 8. Products: expect 27 catalog rows, 16 active and priced, 11 inactive with isPriced = false and price 0
select category, slug, unit, "priceCents", "minChargeCents", "isActive", "isPriced", "membersOnly", "classCredits"
from "RetailProduct" order by category, "sortOrder";

-- 9. Discounts: expect 8, all active; FREEWHEEL -> clay-together, KICKSTART50 -> pottery-kickstart, GRAND30 -> Lehi
select d.code, d.type, d.value, d.scope, d."appliesVia", d."autoCommitmentMonths", d."maxUnits", d."maxUsesPerCustomerPerYear",
       d."productSlug", d."requiresNote", d."requiresGroupEvent", st.slug class_type, l.name studio, d."validFrom", d."validUntil", d."isActive"
from "DiscountCode" d left join "SessionType" st on st.id = d."sessionTypeId" left join "Location" l on l.id = d."locationId" order by 1;

-- 10. Studios: address (needed for tax), tax switch, reader location. Lehi is expected to have no tml_ id yet
select name, "addressLine1", city, state, "postalCode", "taxEnabled", "stripeTerminalLocationId" from "Location";

-- 11. Course sessions that are not linked into a course (see 1.2 B6): in rehearsal this is every one of them
select st.slug, l.name, count(*) upcoming, count(ss."seriesId") linked
from "StudioSession" ss join "SessionType" st on st.id = ss."sessionTypeId" left join "Location" l on l.id = ss."locationId"
where st.kind = 'COURSE' and ss."startsAt" > now() and not ss."isCancelled" group by 1, 2;

-- 12. Who would get the automatic member discount today: members with a commitment on record
select p.slug, p."commitmentMonths", ct.slug term, count(*) from "Membership" m
join "MembershipPlan" p on p.id = m."planId" left join "CommitmentTerm" ct on ct.id = m."commitmentTermId"
where m.status = 'ACTIVE' group by 1, 2, 3 order by 4 desc;
```

### 0.3 Score

| | PASS | PARTIAL | FAIL | Not verifiable here |
|---|---|---|---|---|
| Section 1, CONFIRMED and ASSUMED items (73) | 58 | 12 | 2 | 1 |
| Section 2, OPEN items (12) | 9 | 3 | 0 | 0 |

The two FAILs: **B6** (buying a course does not book the course on this data, at the register or
online) and **H10** (legacy plans cannot be assigned by staff: nothing creates a membership except
the Stripe webhook).

---

## 1. CONFIRMED and ASSUMED items

"Row" means a row in the rehearsal database. Money in the database is integer cents.

### 1.1 Locations and the register

| # | Catalog item | Result | Found |
|---|---|---|---|
| A1 | Provo, "Throw Art Studio" | PASS | `Location` row, active |
| A2 | Lehi, "Throw Art Studio - Lehi" | PASS | `Location` row, active |
| A3 | No cash | PASS | No cash tender route: `src/app/api/pos/orders/[id]/payments/` holds `account-credit, card-manual, card-terminal, comp, gift-card, no-charge` only. Tender views in `PaymentSheet.tsx:32` are `terminal, card, giftcard, credit, comp`. No file in `src/` links to `/admin/pos/drawer`. Leftovers, reachable only by typing the URL: the page `src/app/admin/pos/drawer/**`, the API `src/app/api/pos/drawer/**`, `computeDrawerExpectedCash` in `src/lib/pos.ts:986`, and `cashTenderedCents` / `cashChangeCents` in `_components/types.ts:28-29` |
| A4 | POS bound to exactly one studio | PASS (code read, not run) | `src/app/admin/pos/page.tsx:32-37` loads only the studios the user may sell at; `PosTerminal.tsx:55` remembers the studio per device (`throw.pos.locationId`); catalog, order creation, customer summary and resume list all send that `locationId` (`PosTerminal.tsx:153,155,186,205`); the server refuses a product, session or discount from the other studio (`WRONG_LOCATION`, `DISCOUNT_WRONG_LOCATION`) |
| A5 | A sale reports under its studio | PARTIAL | The order stores it (`PosOrder.locationId`) and so does the mirrored `Payment` (`src/lib/pos.ts:911-917`). But no screen shows it: Order History has no studio column or filter (`OrderHistoryClient.tsx:73-85` sends none, so an admin sees both studios mixed); the Revenue report has no studio filter (`src/app/api/admin/reports/revenue/route.ts`); and walk-in sales (no customer) are not mirrored into `Payment` at all (`src/lib/pos.ts:910,925-926`), so they are missing from the Revenue report. No report reads `PosOrder` |

### 1.2 Classes

| # | Catalog item | Result | Found |
|---|---|---|---|
| B1 | Clay Together, Provo $29.99 | PASS | `SessionTypeLocationPrice` `clay-together` / Provo = 2999, `isConfirmed` true |
| B2 | Clay Together, Lehi $35.00 | PASS | `clay-together` / Lehi = 3500, `isConfirmed` true. 104 upcoming Lehi sessions from 2026-10-01 |
| B3 | Clay Together: event, 120 min, per wheel, up to 2 per wheel, sharing allowed, ticket eligible, tags | PASS | `kind=EVENT, durationMinutes=120, priceUnit=PER_WHEEL, maxPeoplePerWheel=2, allowsWheelSharing=t, isTicketEligible=t, tags={date-night,bachelorette}` |
| B4 | Kickstart $200 at both studios | PASS | `pottery-kickstart` = 20000 at Provo and at Lehi |
| B5 | Kickstart: course, 120 min sessions, no sharing, ticket eligible | PASS | `kind=COURSE, 120, PER_WHEEL, maxPeoplePerWheel=1, allowsWheelSharing=f, isTicketEligible=t` |
| B6 | Buying a Kickstart buys the 4 week course | **FAIL** | Two causes. (1) Online, known gap: `src/app/api/bookings/checkout/route.ts` has no series handling, so $200 books one session. (2) New finding: the register books a series only when sessions share a `seriesId` (`src/app/api/pos/catalog/route.ts:130-134`, `items/route.ts:186-203`), and **0 of 5,055 sessions in the data have a `seriesId`**. Only Admin › Schedule "repeat weekly" sets one (`src/app/api/admin/studio-sessions/route.ts:220`); the Momence import did not, and no script backfills it. So each of the 6 Provo and 5 Lehi upcoming Kickstart sessions shows at the register as its own one-session "course" at $200. Two Lehi sessions are duplicated (two at 2026-10-05 7:30 PM) |
| B7 | Kickstart includes 10 lb clay, bisque and glaze firing | PARTIAL | Copy only (`src/content/classes.ts:354,357`). Nothing in data or code tracks the allowance. The catalog contradicts itself: 10 lb in section 2.1, 15 lb in section 9 item 12 |
| B8 | Guided Pottery Time: 1 ticket, per person, members only, free for Kickstart make-ups | PARTIAL | Row passes: `membersOnly=t, isTicketEligible=t, PER_PERSON, $0`. "Free for Kickstart make-ups" is not implemented: no make-up logic anywhere in `src/` |
| B9 | Kids Summer Camp, course, $199, per person, ages 8–17 | PASS | `kind=COURSE, 19900, PER_PERSON, minAge=8, maxAge=17`. "4 days" is not modelled. No upcoming sessions |
| B10 | Group Event / Private Booking, $375 flat, private | PARTIAL | Row passes: `37500, FLAT, isPublic=f`, 1 upcoming session. But nothing can sell it at that price: the register and online checkout both require `isPublic` (`src/lib/sellable.ts:74-83`), so a group event is refused as `NOT_FOR_SALE` and staff must type $375 as a Custom line |
| B11 | Workshop: tag `workshop`, price and ticket eligibility per session | PASS | `tags={workshop}`, base price 0, so it is for sale only once a session has `priceCentsOverride`. Side effect: a public workshop session with no price prints "Members only" on the schedule (`src/app/(public)/schedule/page.tsx:113-115`) |
| B12 | Private Lesson, $55, members $43 | PARTIAL | Row passes: `5500`, `memberPriceCents=4300`, `isPublic=f`. Same gap as B10 (not sellable), and the register never asks for the member price (`items/route.ts:219-223` does not pass `isMember`) |
| B13 | Lehi After-School course, $257, 6 × 120 min, ages 8–17 | PARTIAL | Price row 25700 Lehi, ages 8–17, 120 min. 7 upcoming sessions (Wednesdays 2026-10-07 to 11-11, two on 10-07), none linked by `seriesId`: same problem as B6, each session sells alone for $257, online and at the register |
| B14 | Lehi Homeschool course, $257 | PASS | Price row 25700 Lehi, ages 8–17. No sessions yet |
| B15 | Member classes cost one ticket, members only, never a drop-in | PASS | 7 rows (`pottery-101-*` × 4, `member-orientation`, `member-event`, `open-studio-members-only-multi-venue`): `membersOnly=t, isTicketEligible=t, $0`. `SELLABLE_SESSION_TYPE` excludes `membersOnly` (`src/lib/sellable.ts:24-30`) |
| B16 | Dated cohorts are sessions, not class types | PASS | 17 active class types, none with a date in its name; 44 archived |
| B17 | Section 8 "not offered" entries are never sellable | PASS | Archived and inactive: 90 Min Pottery Class, Free Pottery Wheel Experience - Provo, Bree Goates, Meredith's Group, Keyla bachelorette party, Pay for Pottery Pieces, Pottery Piece Pick Up!, Studio Tour, Orem Farmers Market, Wheel Throwing 101, Open Studio ($15), Hand Building Workshop. Busy Window is active but `isBusyWindow=t, isPublic=f`. 293 upcoming "Pay for Pottery Pieces" sessions and 1 "Orem Farmers Market" session remain on archived types, hidden |
| B18 | Paid drop-ins cannot join a waitlist | PASS | Online `SESSION_FULL` 409 before payment (`bookings/checkout/route.ts:84-88`); register `SESSION_FULL` (`items/route.ts:245-257`). Race fallback only: a seat lost between payment and booking becomes a WAITLIST booking with an order note |

### 1.3 Piece charges

| # | Item | Result | Row in `RetailProduct` |
|---|---|---|---|
| C1 | 1 lb piece $9.99 | PASS | `piece-1lb` 999, PIECES, EACH |
| C2 | 1.5 lb piece $12.99 | PASS | `piece-1-5lb` 1299 |
| C3 | 2 lb piece $14.99 | PASS | `piece-2lb` 1499 |
| C4 | Add a handle $1.50 | PASS | `add-handle` 150 |
| C5 | Glazed by us $7.99 | PASS | `glazed-by-us` 799 |
| C6 | Extra clay $3.00 per lb | PASS | `extra-clay` 300, unit LB |

### 1.4 Member firing

| # | Item | Result | Found |
|---|---|---|---|
| D1 | Glaze firing $1.00 per lb | PASS | `glaze-firing` 100, LB, `membersOnly=t` |
| D2 | Oversize (over 12 in) $1.75 per lb | PASS | `glaze-firing-oversize` 175, LB, `membersOnly=t` |
| D3 | Minimum $1.00 per piece | PASS | `minChargeCents=100` on both rows; one minimum used for both (`src/lib/pos.ts:420`) |
| D4 | Bisque firing $0.00 | PASS | `bisque-firing` 0, EACH, active, priced, `membersOnly=t` |
| D5 | Exact weight to 0.1 lb, rate × weight rounded to the cent, then the minimum | PASS | `src/lib/firing.ts:59-62` (hundredths, then tenths, halves up), `:95` (round to the cent, halves up), `:96` (minimum). Integer tenths and cents only. Rates come from the two product rows (`src/lib/pos.ts:403-423`), no price in code |
| D6 | Members and enrolled students only | PASS | `isMemberOrEnrolledStudent`, `src/lib/pos.ts:366-381` (ACTIVE member, or a CONFIRMED booking in a COURSE class from the last 90 days on); enforced on add (`items/route.ts:96`), on the firing route and again before payment. "Enrolled = 90 days" is an assumption to confirm |

### 1.5 Clay

| # | Item | Result | Row |
|---|---|---|---|
| E1 | B-Mix $1.00 per lb | PASS | `clay-b-mix` 100, LB |
| E2 | Recycled clay $0.50 per lb | PASS | `clay-recycled` 50, LB |

### 1.6 Class packs

| # | Item | Result | Found |
|---|---|---|---|
| F1 | 5 classes $150 | PASS | `class-pack-5` 15000, `classCredits=5` |
| F2 | 10 classes $270 | PASS | `class-pack-10` 27000, 10 |
| F3 | 15 classes $360 | PASS | `class-pack-15` 36000, 15 |
| F4 | Credits never expire, not shareable | PARTIAL | `ClassCreditLedger` has no expiry column and is per user; a customer is required to buy a pack. **Known gap confirmed: credits are granted and shown but nothing spends them.** Every use of `classCreditLedger` is in `src/lib/pos.ts` (`:388` balance, `:777-782` grant, `:840-849` void). No booking route and no tender reads it. A customer who buys a pack today cannot use it |

### 1.7 Shipping

| # | Item | Result | Row |
|---|---|---|---|
| G1 | 1–2 pieces $25 | PASS | `shipping-1-2-pieces` 2500 |
| G2 | 3–4 pieces $45 | PASS | `shipping-3-4-pieces` 4500 |

### 1.8 Memberships

| # | Item | Result | Found |
|---|---|---|---|
| H1 | Sold online only; the POS never starts a subscription | PASS | Memberships tab is lookup only (`CatalogPanel.tsx:23-30`, `catalog/MembershipTab.tsx` adds nothing). Note: the API still accepts a `MEMBERSHIP` line for any plan id, legacy included (`items/route.ts:288-297`); completion does nothing with it, so money could be taken for no membership if another client called it |
| H2 | Existing customer subscriptions untouched | Not verifiable here | Rehearsal has 0 `Membership` rows. Use spot-check 5 on production |
| H3 | Provo Basic $70 / 8 / none, Pro $110 / 10 / half, Expert $120 / 12 / full | PASS | `provo-basic` 7000 · 8 · null, `provo-pro` 11000 · 10 · HALF, `provo-expert` 12000 · 12 · FULL; 30 days |
| H4 | Lehi standard plans equal to Provo, marked needs confirmation | PASS | `lehi-basic` / `-pro` / `-expert` same numbers, `priceNeedsConfirmation=t`. See section 2, O1 |
| H5 | 24/6 access, clay and firing discounts, studio glazes, workshops and member events | PASS | `perks` JSON on all 9 public plans |
| H6 | Founding Basic $55, Pro $95, Expert $105 | PASS | `lehi-founding-basic` 5500, `-pro` 9500, `-expert` 10500, `isFounding=t` |
| H7 | 50 founding members in total across the three tiers | PASS | One `MembershipCapGroup` `lehi-founding`, cap 50, on all three plans. Counted across the group, ACTIVE + PAUSED (`src/lib/membershipCatalog.ts:27,54-70`); refused with `PLAN_SOLD_OUT` (`:97-99`); `/membership` hides a full plan (`src/app/(public)/membership/page.tsx:84-87`). Caveat from the audit: check-then-checkout, a last-seat race can oversell by one |
| H8 | Founding rate forfeited on cancel or freeze | PARTIAL | Stored (`forfeitsRateOnCancelOrFreeze=t` on the 3 plans, `FreezePolicy.forfeitsFoundingRate=t` at both studios) and shown to the customer (`membership/page.tsx:232-234`). No pause, cancel or resume route reads either flag, so nothing enforces it |
| H9 | Legacy plans: Pro Legacy $90 / mo, Student Monthly $60 / mo, Basic Annual $500 / yr; not public, not purchasable | PASS | `pro-legacy` 9000 / 30 d, `student-monthly` 6000 / 30 d, `basic-annual` 50000 / 365 d; `isLegacy=t, isPublic=f`. Refused online with `PLAN_LEGACY` (`membershipCatalog.ts:94`) |
| H10 | Legacy plans are staff assignable | **FAIL** | Nothing lets staff put a customer on a plan. `prisma.membership.create` exists only in the Stripe webhook; `src/app/api/admin/memberships/**` has list, pause, cancel, adjust-tickets and events only |
| H11 | Month to month: $25 joining fee | PASS | `month-to-month` 2500. Charged once, only to someone with no earlier membership (`src/app/api/memberships/subscribe/route.ts:72,104`) |
| H12 | 3 month: fee waived, 10% retail, video library | PASS | `3-month` months 3, fee 0, 10, `includesVideoLibrary=t`. The video library is a flag only |
| H13 | 12 month: fee waived, 20% retail, guest pass, video library | PASS | `12-month` months 12, fee 0, 20, `includesGuestPass=t`, `includesVideoLibrary=t`. The included guest pass is recorded by the webhook (`src/app/api/webhooks/stripe/route.ts:185-189`) |
| H14 | 12 month: 1 month free | PARTIAL | `freeMonths=1` is stored and **advertised** on `/membership` (`page.tsx:362-364`) and on the subscribe form (`SubscribeForm.tsx:34-35`). **Known gap confirmed: no billing logic.** `freeMonths` is read only by admin and display code; `subscribe/route.ts` sets no trial or coupon. Customers are promised a free month nobody applies |
| H15 | Guest pass add-on, $25 / month | PARTIAL | `MembershipAddOn` `guest-pass` 2500 / 30 d, active, no Stripe price. **Known gap confirmed: it cannot be bought.** Only the included assignment exists |

### 1.9 Gift cards and tax

| # | Item | Result | Found |
|---|---|---|---|
| I1 | Gift cards never expire | PASS | Register issue sets no `expiresAt` (`src/lib/pos.ts:614-628`); admin create sets `expiresAt: null` (`src/app/api/admin/gift-cards/route.ts:50`). The admin PATCH API still accepts an expiry date (`gift-cards/[id]/route.ts:13-23`), and imported cards were not in this copy |
| I2 | Custom amount | PASS | Any positive amount (`items/route.ts:298-307`); presets $25 / $50 / $100 plus a custom field (`catalog/GiftCardTab.tsx:9`) |
| I3 | Redeemable on anything; a tender in the POS and online | PARTIAL | Register: any order. Online: class checkout only (`/api/bookings/checkout`). A gift card cannot pay for a membership and cannot be bought online |
| I4 | Sales tax by Stripe Tax only | PASS | `src/lib/stripeTax.ts:63` (`stripe.tax.calculations.create`). No tax rate or hand calculation anywhere in `src/`. With no studio address or with tax off it charges $0 tax and shows a warning (`:53-56`); both rehearsal studios have no address |
| I5 | Every product and category carries a tax code | PASS | All 27 product rows have `taxCode` null, so the category default applies (`src/config/taxCodes.ts:47-54`): RETAIL / PIECES / FIRING / CLAY `txcd_99999999`, SHIPPING `txcd_92010001`, CLASS_PACK not taxed; item types at `:26-33` (classes, memberships and gift cards not taxed, custom lines `txcd_99999999`) |

### 1.10 Discounts

| # | Item | Result | Found (`DiscountCode` row, then code) |
|---|---|---|---|
| J1 | Staff 10%, everything, staff applied | PASS | `STAFF10` percent 10, EVERYTHING, STAFF |
| J2 | 3 month commitment 10%, retail only, automatic | PASS | `COMMIT3` percent 10, RETAIL, AUTOMATIC, `autoCommitmentMonths=3` |
| J3 | 12 month commitment 20%, retail only, automatic | PASS (rule), not exercised on real data | `COMMIT12` percent 20, RETAIL, AUTOMATIC, 12. Longest qualifying one only (`src/lib/discounts.ts:294-303`). It fires from the member's `CommitmentTerm`, else `plan.commitmentMonths` (`src/lib/pos.ts:144-157`). All 12 plans here have `commitmentMonths` null and there are no memberships, so run spot-check 12: until members carry a term, nobody gets it |
| J4 | Retail discounts never touch clay or firing | PASS | `lineMatchesDiscount`, `src/lib/discounts.ts:106-130`: RETAIL scope matches category RETAIL only (`:121-122`); gift card and membership lines never (`:107`) |
| J5 | Group event extras 20%, pieces only, only on group event orders | PASS | `GROUPEXTRAS20` percent 20, PIECES, STAFF, `requiresGroupEvent=t` (`discounts.ts:134,367`). The event is kept in the discount's note, not a column |
| J6 | Get Out Pass: one 1 lb piece free, once per customer per year | PASS | `GETOUTPASS` percent 100, PIECES, `productSlug=piece-1lb`, `maxUnits=1`, `maxUsesPerCustomerPerYear=1`. Needs a customer (`discounts.ts:362-365`); rolling 365 days, voided sales not counted (`src/lib/pos.ts:309-331`). PIECES scope leaves the wheel reservation at full price |
| J7 | Free Wheel Experience coupon: 100% off one Clay Together wheel, note required | PASS | `FREEWHEEL` percent 100, CLASSES, `maxUnits=1`, `requiresNote=t`, linked to `clay-together` |
| J8 | KICKSTART50: 50% off Kickstart, promo code, dates editable | PASS | percent 50, CLASSES, CODE, linked to `pottery-kickstart`, no dates set |
| J9 | GRAND30: 30% off Lehi courses | PARTIAL | percent 30, CLASSES, CODE, Lehi, active, no dates. It is not limited to courses: CLASSES scope is every class line (`discounts.ts:125-126`) and the row has no class type, so it also takes 30% off a $35 Lehi Clay Together wheel |
| J10 | Promo codes fully manageable in admin | PASS | Admin reads and writes the `DiscountCode` table, not Stripe coupons (`src/app/api/admin/discount-codes/route.ts:8`) |

Extra rule not in the catalog, worth knowing at the register: any staff-applied discount of 50% or more, or $20 or more, needs a note (`cart/discountPolicy.ts:8-13`, enforced at `discounts/route.ts:96-97`). That covers Get Out Pass and the Free Wheel coupon.

---

## 2. OPEN items: null or inactive, and hidden from customers

Customer-facing queries checked: `src/app/(public)/membership/page.tsx:77-78` (`PURCHASABLE_PLAN_WHERE`),
`src/app/(public)/schedule/page.tsx:25-41` and `[id]/page.tsx:77-83` (`PUBLICLY_LISTED_SESSION_TYPE`, price
through `isSellable`), `src/app/api/pos/catalog/route.ts:48-50` (`isActive, isPriced, archivedAt: null`)
and `:52-56, 62-69` (`SELLABLE_SESSION_TYPE`, price > 0).

| # | OPEN item | Result | Found |
|---|---|---|---|
| O1 | Lehi standard membership prices | PARTIAL | Not null and not hidden: `lehi-basic` / `-pro` / `-expert` are public and purchasable at $70 / $110 / $120. `priceNeedsConfirmation` is read only by admin code, so customers see these as firm prices. This follows the catalog's "seeded equal to Provo"; confirm before Lehi memberships are promoted |
| O2 | Ticket rollover | PASS | `ticketRolloverEnabled=f`, `ticketRolloverMaxTickets` null on all 12 plans. Not mentioned on `/membership` |
| O3 | Tickets and shelf for legacy plans | PASS | 0 tickets, no shelf, deliberately not null (null means unlimited in `src/lib/credits.ts:36`). Consequence: a member put on a legacy plan has no tickets and cannot book a member class until the client answers |
| O4 | Freeze fee and credit per frozen month | PASS | `monthlyFeeCents` and `creditCentsPerFrozenMonth` null at both studios. Not shown on `/membership` |
| O5 | Piece over 2 lb | PASS | `piece-over-2lb` inactive, `isPriced=f`, $0; filtered out of the register |
| O6 | Speckled Buff, Charcoal, 10 lb and 25 lb bags, sample pack | PASS | 9 rows, all inactive, `isPriced=f`, $0 |
| O7 | Shipping for 5 or more pieces | PASS | `shipping-5-plus-pieces` inactive, `isPriced=f`, $0 |
| O8 | Durations: Guided Pottery Time, Group Event, Private Lesson | PARTIAL | `durationMinutes` is NOT NULL, so they hold placeholders copied from the rows they replaced: 90, 120, 90. Group Event and Private Lesson are private. Guided Pottery Time is publicly listed, so 90 minutes would show once a session is scheduled (none upcoming) |
| O9 | Lehi After-School and Homeschool: in the catalog, and ticket eligible? | PASS | Both active at $257 (live on the site). `isTicketEligible=f`, so no ticket can be spent until the client says so |
| O10 | GRAND30 end date and scope | PARTIAL | `validFrom` and `validUntil` null. For a discount null means no end, so it is active indefinitely, at the wider scope described in J9 |
| O11 | Kids Summer Camp ages, 8–17 or 10–17 | PASS | Stored as 8–17 (the prompts' value). No camp sessions scheduled, so nothing shows |
| O12 | Kickstart clay past the allowance | PASS | Nothing charges it. The 15 lb constant went with `src/config/firingPrices.ts`; no allowance exists in code |

---

## 3. Hardcoded values still in the code

### 3.1 Audit section 7, line by line

| Audit entry | Now | Where |
|---|---|---|
| `firingPrices.ts` 100 / 175 ¢ per lb | Removed | File deleted, no imports; rates come from product rows |
| `firingPrices.ts` 999 / 1299 / 1499 | Removed | Product rows |
| `firingPrices.ts` 15 lb Kickstart allowance | Removed | No allowance anywhere in code |
| `firingPrices.ts` 50 ¢ per lb recycled clay, bag sizes | Removed | `clay-recycled` row; bags are OPEN rows |
| Tax codes | Still hardcoded, by design | `src/config/taxCodes.ts:21-22, 26-33, 47-54`; a product row can override |
| Gift card presets $25 / $50 / $100 | Still hardcoded, moved | `src/app/admin/pos/_components/catalog/GiftCardTab.tsx:9` |
| POS tip presets $1 / $2 / $5 | Still hardcoded | `src/app/admin/pos/_components/CartPanel.tsx:55` |
| On-reader tips 15 / 18 / 20 % | Still hardcoded | `src/lib/terminal.ts:22` |
| 7 days of sessions | Changed to today + 7 (8 days), still hardcoded; courses 120 days | `src/app/api/pos/catalog/route.ts:15,18` |
| Void grace period 24 h | Still hardcoded, twice | `src/app/api/pos/orders/[id]/void/route.ts:8`, `orders/_components/OrderHistoryClient.tsx:143` |
| 1 ticket per booking | Still hardcoded | `src/lib/credits.ts:165,191` |
| Customer tips $1 min, $100 max, presets | Still hardcoded | `src/app/api/tips/route.ts:6-7`, `src/app/(customer)/bookings/[id]/tip/_components/TipForm.tsx:9` |
| Shelf sizes on `/membership` | Still hardcoded, moved | `src/app/(public)/membership/page.tsx:58-59` ("48×24×12", "24×24×12"). Price, tickets, fees and perks are data |
| Home page copy | Still hardcoded, see 3.3 | `src/content/site.ts:17,48,56,67,79` |
| Class page copy | Still hardcoded, see 3.3 | `src/content/classes.ts:180,232,239,282,354,357` |
| Stripe coupon `duration: "once"` | Removed | Admin discounts use the `DiscountCode` table |
| Two gift card code alphabets | Removed | One generator, `src/lib/giftCardCode.ts` |
| Preorder widget placeholder slugs, max quantity 20 | Still there | `src/app/api/preorder/checkout/route.ts:30,48` (the TODO about placeholder slugs is still in the file) |
| `prisma/seed.ts` demo plans and classes | Still there, dev only | The sync scripts retire those slugs |

### 3.2 New in `src/app/admin/pos/**`

No price, product slug, class type slug or discount code is hardcoded in the register. Found:

| File:line | Value | Meaning |
|---|---|---|
| `cart/discountPolicy.ts:10,12` | 50 %, 2000 ¢ | Staff discount at or above this needs a note (shared with the server) |
| `catalog/PiecesFiringTab.tsx:329,354,377` | "over 12 in" | Oversize wording (copy; the rate is data) |
| `CartPanel.tsx:57`, `TerminalPane.tsx:21`, `payment/useReaderStatus.ts:33` | 8000, 1200, 30000 ms | Notice and polling timers |
| `CustomTab.tsx:45`, `LineItemRow.tsx:99`, `DiscountDialog.tsx:200`, `PosTerminal.tsx:661`, `CustomAmountDialog.tsx:103` | 200 / 500 / 120 | Text length limits |
| `drawer/_components/DrawerClient.tsx:32` | 500 ¢ | Cash variance alert, on the unlinked drawer page |
| `src/app/api/pos/orders/route.ts` | 12 h | Own unparked orders shown in the resume list |
| `src/lib/pos.ts:123,310,359` | 7 days, 365 days, 90 days | Group event lookback; "once per year" window; "enrolled student" window |

### 3.3 Marketing copy that disagrees with the catalog (report only)

| File:line | Says | Catalog |
|---|---|---|
| `src/content/site.ts:17` | Banner: "40% off 4 week courses" | No 40% offer exists. KICKSTART50 is 50%, GRAND30 is 30% |
| `src/content/site.ts:48` | "One time class: $40 + $8-12 per piece" | $29.99 (Provo) / $35 (Lehi) per wheel + $9.99–$14.99 per piece |
| `src/content/classes.ts:180` | "$40 to reserve your wheel, then $10 when you pick up your 1lb piece. $50 total." | $29.99 / $35 per wheel; 1 lb piece $9.99 |
| `src/content/classes.ts:232` | "$40 for the two of you. $29.99 now, $10 at pickup." | Wheel price right for Provo only (Lehi $35); piece $9.99, and the sum is not $40 |
| `src/content/classes.ts:239` | "$100 for the two of you. $80 now, $20 at pickup." | No $80 class exists in the catalog |
| `src/content/classes.ts:357` | "10lbs of clay" | 10 lb in catalog section 2.1, 15 lb in section 9 item 12: the catalog itself needs settling |
| `src/content/classes.ts:282` | "Flat fee of $375" | Matches |
| `src/content/classes.ts:354`, `site.ts:56` | "$200" | Matches |
| `src/content/site.ts:67` | "Starts from $70 per month" | Matches Provo; Lehi founding starts at $55 |
| `src/content/site.ts:79` | "Special pricing for groups of 8+" | Catalog has one flat $375, no group size |
| `src/content/classes.ts:201` | "Wheel classes are for ages 12 and up" | No minimum age on Clay Together or Kickstart in the catalog or the rows |

---

## 4. Manual POS test script

Run on a test or preview deployment with Stripe **test** keys, never against real customers. One person,
about 45 minutes. Record the order number at each test.

**Set up first (admin):**
1. Studio Set-up › Products: create a RETAIL product "Test mug", $20.00, stock tracking off.
2. Studio Set-up › Gift cards: create a gift card for $10.00. Write down the code.
3. Customers: "Test Walkin" (no membership); "Test Member", with an ACTIVE membership bought online on the
   12 month commitment (memberships can only be created by subscribing online: see H10).
4. Admin › Schedule: create a Pottery Kickstart at Provo with "repeat weekly" × 4, first session at
   least a day away. This is the only way to get a linked course (see B6).
5. Both studio addresses filled in (Studio Set-up › Locations), or every test will show $0.00 tax with a
   yellow warning.

**Card steps.** "Pay by card" needs either a real Stripe reader registered to the studio, or manual card
entry, which needs `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set. Steps marked **[reader]** must be done once on
a real reader: the reader waiting screen and its Cancel button have never been runtime-tested. Tax is
whatever Stripe Tax returns; the expected figures below are before tax.

| # | Step | Expected |
|---|---|---|
| **T1** | **Walk-in: two 1 lb pieces and a handle** | |
| 1.1 | Open `/admin/pos`. Header shows "Provo". | Pieces & Firing tab is open by default |
| 1.2 | Tap "1 lb piece" twice, fast | One line, quantity 2, $19.98; the button shows a count of 2 |
| 1.3 | Tap "Add a handle" | Line $1.50. Subtotal **$21.48**, no discount |
| 1.4 | Type walk-in name "T1". Charge › card **[reader]** | Reader shows the total; after the tap the order completes, receipt choice appears |
| 1.5 | **[reader]** Repeat 1.2–1.4 on a new order, but press **Cancel** while the reader is waiting | Reader clears, the order stays open with the full balance owed, no payment recorded. Then pay normally |
| **T2** | **12 month member: 20% off retail, nothing off a piece** | |
| 2.1 | New order, attach "Test Member" | Customer panel shows the plan; a discount "12 month commitment" appears by itself, at $0.00 |
| 2.2 | Retail tab › "Test mug" | Line $20.00, discount **−$4.00**, line total **$16.00** |
| 2.3 | Pieces & Firing › "1 lb piece" | Line **$9.99, no discount**. Subtotal after discount **$25.99** |
| 2.4 | Try to remove the automatic discount | No remove control, or refused: remove the customer instead. Removing the customer takes the discount off and the mug goes back to $20.00; re-attach to continue |
| 2.5 | Pay by card | Completes. Receipt lists "12 month commitment −$4.00" |
| **T3** | **Member firing: three pieces, one oversize, one under the minimum** | |
| 3.1 | New order, attach "Test Member". Pieces & Firing › member firing calculator | Calculator is enabled (it is off, with a reason, when no member is attached: check that on an order with "Test Walkin") |
| 3.2 | Piece 1: 2.3 lb, not oversize | **$2.30** |
| 3.3 | Piece 2: 3.5 lb, "Over 12 in" on | **$6.13** (3.5 × $1.75 = $6.125, rounded up to the cent) |
| 3.4 | Piece 3: 0.4 lb, not oversize | **$1.00**, marked "minimum applied" (weight charge would be $0.40) |
| 3.5 | Add to order | Three lines: "Glaze firing, 2.3 lb" 230¢, "Glaze firing, oversize, 3.5 lb" 613¢, "Glaze firing, 0.4 lb" 100¢. Total **943¢ = $9.43** before tax. No member discount on any of them, quantities locked |
| 3.6 | Pay by card | Completes |
| **T4** | **Get Out Pass: one free 1 lb piece, refused the second time** | |
| 4.1 | New order, **no customer**. Add one 1 lb piece. Discount › Get Out Pass | Refused: "This discount is limited per customer. Attach the customer first." |
| 4.2 | Attach "Test Walkin". Add a second 1 lb piece (2 on the order). Discount › Get Out Pass, leave the note empty | Refused: a discount this large needs a note |
| 4.3 | Same, with note "Get Out Pass #1234" | Discount **−$9.99**: one piece free, the other still $9.99. Balance $9.99 |
| 4.4 | Pay by card | Completes |
| 4.5 | New order, attach "Test Walkin", add a 1 lb piece, Discount › Get Out Pass with a note | Refused: "This customer has already used that discount this year." |
| **T5** | **Split payment: gift card then card** | |
| 5.1 | New order, walk-in. Add a 2 lb piece ($14.99) | Balance $14.99 plus tax |
| 5.2 | Charge › Gift card, type the code from set-up (any case, with or without dashes) | Shows the card balance $10.00. Apply: "Gift card took $10.00. It has $0.00 left." Order still open, balance **$4.99** plus tax |
| 5.3 | Pay the rest by card | Completes; receipt shows both tenders |
| 5.4 | Charge a new order to the same gift card | Refused: the card is empty |
| **T6** | **Parked and resumed order** | |
| 6.1 | New order, walk-in name "Parked T6", add a 1.5 lb piece ($12.99). Press Park order | Register shows a fresh empty order; the Resume button count goes up by 1 |
| 6.2 | Ring and complete a different small sale (comp or gift card is fine) | Completes normally |
| 6.3 | Resume › "Parked T6" | The 1.5 lb piece and the name are back, $12.99. If something was on the register it is parked, not lost |
| 6.4 | Sign in as a different staff member at the same studio, open Resume | The parked order is listed for them too |
| **T7** | **Lehi prices and Lehi reporting** | |
| 7.1 | Switch the header studio to "Lehi" with an item on the order | Notice: the order was parked at Provo and a new one opened at Lehi |
| 7.2 | Classes tab (a Lehi session must be within today + 7 days; the first is 2026-10-01) | Clay Together: Pottery Wheel Experience shows **$35.00**. At Provo the same class shows $29.99 |
| 7.3 | Attach "Test Walkin", add the class, Charge › card reader | **Expected to fail until Lehi is linked to a Stripe Terminal Location** (see section 5). Pay with manual card entry or a gift card instead |
| 7.4 | Admin › POS › Order history | The order is listed. **Known gap: there is no studio column or filter, and the Revenue report has no studio breakdown** (A5). To confirm the studio today: `select "orderNumber", "locationId" from "PosOrder" order by "createdAt" desc limit 5;` |
| 7.5 | As a staff member assigned to Provo only, open `/admin/pos` | Lehi is not offered in the header |
| **T8** | **Kickstart sold at the register books every remaining session** | |
| 8.1 | Provo, Classes tab, Courses group | The course from set-up step 4 appears once, "4 sessions", **$200.00**. (Imported Kickstart sessions appear as separate one-session courses at $200 each: that is finding B6, do not sell those) |
| 8.2 | Attach "Test Walkin", add the course | One line, "Pottery Kickstart: 4 Week Course, 4 sessions from …", $200.00, quantity locked |
| 8.3 | Add the same course again | Refused: already in this order |
| 8.4 | Pay by card | Completes |
| 8.5 | Customers › Test Walkin › bookings | **Four** confirmed bookings, one per session. The customer gets one confirmation email per session (known) |
| 8.6 | Order history › void that order (reason required) | All four bookings cancelled. The card is not refunded by a void: refund it in Stripe |
| **T9** | **$0 order: bisque firing only, no tender** | |
| 9.1 | New order, walk-in, Pieces & Firing › Bisque firing | Refused: members and enrolled students only |
| 9.2 | Attach "Test Member", add Bisque firing | Line $0.00, total $0.00 |
| 9.3 | The charge button reads "Complete order · nothing to pay". Press it | Completes with **no payment recorded** and no tender screen |
| 9.4 | Try the same on an empty order | Not possible (`EMPTY_ORDER`) |
| **T10** | **No cash anywhere** | |
| 10.1 | Open the tender sheet on any order with a balance | Tenders offered: card reader, card entry, gift card, account credit (only when the customer has some), comp. **No Cash** |
| 10.2 | Look through the POS header, the admin sidebar and Order history | **No "Cash Drawer" link.** (The old page still opens if someone types `/admin/pos/drawer`; note it if that matters) |

---

## 5. Before go-live: only the owner can do these

| # | To do | Why |
|---|---|---|
| 1 | Set in Vercel (reported as not set; not checkable from the repo): `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Manual card entry at the register (`_components/stripeClient.ts`); every email, receipts included (`src/lib/resend.ts`); image uploads (`src/app/api/upload/route.ts`); background jobs, confirmations and automatic receipts (`src/lib/inngest.ts`) |
| 2 | Activate Stripe Tax and add the Utah registration in the Stripe dashboard; fill in both studio addresses in Studio Set-up › Locations | Without them every sale is charged $0 tax with a warning (`src/lib/stripeTax.ts:53-56`) |
| 3 | Create a Stripe Terminal Location for Lehi, link it in Studio Set-up › Locations, and register the Lehi reader to it | Lehi has none; the card reader tender fails there (`src/lib/terminal.ts:39`). Check Provo's link too (spot-check 10) |
| 4 | Run on production, in this order, dry run first then `--apply`: `sync:plans`, `catalog:sync-class-types`, `sync:products`; then the queries in 0.2 | Production still holds the old plans, 52 class types at $0 and no products or discounts |
| 5 | Ask every staff member to sign out and sign back in | Their studios are stored in the sign-in token (`src/auth.config.ts:17-31`); an old token does not know which studios they may sell at |
| 6 | Create the retail (shelf) products in Studio Set-up › Products | There are none; the Retail tab is empty and the member 10% / 20% discount has nothing to apply to |
| 7 | Decide what to do about courses before anyone buys one (B6, B13) | Recreate upcoming Kickstart and After-School cohorts with "repeat weekly", or have the sessions linked; remove the duplicate Lehi sessions on 10-05 and 10-07. Until then $200 / $257 buys one session |
| 8 | Decide on the promises the system cannot keep yet | 12 month "1 month free" is advertised and not applied (set `freeMonths` to 0 in admin, or apply by hand); class packs can be sold and not spent (deactivate the three pack products until spending exists); guest pass cannot be bought; founding-rate forfeiture is by hand; legacy plans cannot be assigned |
| 9 | Fix the marketing copy in 3.3, the "40% off 4 week courses" banner first | It advertises prices and an offer the checkout will not honour |
| 10 | Send the client the OPEN questions (catalog section 9) | 1 Lehi standard membership prices · 2 ticket rollover · 3 tickets and shelf for legacy plans · 4 freeze fee and credit · 5 piece over 2 lb · 6 Speckled Buff, Charcoal, bags, sample pack · 7 shipping 5+ · 8 durations for Guided Pottery Time, Group Event, Private Lesson · 9 Lehi After-School / Homeschool: ongoing, and tickets? · 10 GRAND30 end date and scope (today it has no end and covers every Lehi class) · 11 Summer Camp ages 8–17 or 10–17 · 12 Kickstart clay past the allowance, and is the allowance 10 lb or 15 lb. Also to confirm: "enrolled student" = 90 days, "once per year" = rolling 365 days |


---

## Addendum after this pass (2026-09-21)

The verification pass itself changed nothing. One FAIL was then fixed because it would
have mis-sold courses at the register:

- **B6 (no session has a `seriesId`)** — `scripts/backfill-course-series.ts`
  (`npm run catalog:backfill-series`, dry run by default) groups upcoming COURSE sessions
  into cohorts by class, studio, weekday and start time, and leaves Momence's multi-week
  "container" rows out, listing them for the owner to cancel. On the rehearsal copy: Lehi
  Kickstart = 4 Mondays, After-School = 6 Wednesdays, second run no changes. Online
  checkout still books a single session of a course; only the register books the series.

Still open from this document: H10 (no staff screen to assign a legacy plan to a member),
class pack credits can't be spent yet, the 12-month free month isn't billed, the guest
pass isn't sold at checkout, Group Event and Private Lesson can't be rung up as classes
(use a Custom line with a description), GRAND30 has no end date and also discounts Lehi
Clay Together, and the Lehi standard plans are purchasable while still flagged
"needs confirmation".
