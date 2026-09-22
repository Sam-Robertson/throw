# Throw Art Studio — Catalog (source of truth)

> **Provenance.** The original `throw-catalog.md` was not on disk when this work
> started (2026-09-19). This file was reconstructed from the seven "Catalog
> Accuracy and POS" build prompts, which quote the catalog's values, plus prices
> read directly from throwartstudio.com on 2026-09-19 and decisions Sam gave in
> the build session. Nothing here was guessed: anything the prompts or the site
> do not state is marked **OPEN** and must stay null / inactive in the product.
> If the original file turns up, diff it against this one and re-run the
> verification in `docs/catalog-verification.md`.

Status tags: **CONFIRMED** (stated by Sam or charged on the live site),
**ASSUMED** (stated in the build prompts, not independently verified),
**OPEN** (no value — do not guess).

All money is USD. Anything that can differ between studios is per location.

---

> **Scope change, 2026-09-21 (Sam).** The catalog is ONLY what throwartstudio.com
> sells. The sync scripts now create exactly the rows in section 0 and archive
> everything else this build had added (member classes, workshops, private
> lessons, firing and clay products, shipping, staff discounts, founding and
> legacy plans, commitment terms, guest pass, freeze policy). Sections 1–9 below
> are kept as the record of what the build prompts asked for; where they go
> beyond section 0 they are NOT loaded into the database.

## 0. What is live (matches the website)

| Kind | Row | Price |
|---|---|---|
| Class | Clay Together: Pottery Wheel Experience (date night and bachelorette are landing pages on it) | Provo $29.99 · Lehi $35.00 per wheel |
| Class | Pottery Kickstart: 4 Week Course | $200 per wheel |
| Class | Group Event / Private Booking (the "Group Pottery Class" page; private, booked by staff) | $375 flat |
| Class | Kids Summer Camp | $199 |
| Class | After-School Pottery Course (Lehi) | $257 |
| Class | Homeschool Pottery Course (Lehi) | $257 |
| Internal | Busy Window (schedule block, never sellable) | — |
| Product | 1 lb / 1.5 lb / 2 lb finished piece | $9.99 / $12.99 / $14.99 |
| Product | 5 / 10 / 15 class pack (credits never expire, individual use) | $150 / $270 / $360 |
| Plan | Basic / Pro / Expert, Provo and Lehi (8 / 10 / 12 tickets; no / half / full shelf) | $70 / $110 / $120 a month |
| Code | GRAND30, 30% off Lehi classes (end date not on the site) | — |

## 1. Locations

| Location | Name in the app | Short label | Status |
|---|---|---|---|
| Provo | Throw Art Studio | Provo | CONFIRMED |
| Lehi | Throw Art Studio - Lehi | Lehi | CONFIRMED (opens October 2026) |

- The studio does **not take cash**. CONFIRMED by Sam 2026-09-19. (The build
  prompts still describe a cash tender and cash drawer; Sam's statement wins.)
- The POS is always bound to exactly one location. CONFIRMED.

## 2. Classes

### 2.1 Class types

| # | Class type | Kind | Duration | Price | Unit | Notes | Status |
|---|---|---|---|---|---|---|---|
| 1 | Clay Together: Pottery Wheel Experience | event | 120 min | Provo $29.99 · Lehi $35.00 | per wheel | up to 2 people per wheel, wheel sharing allowed, ticket eligible. Tags: date-night, bachelorette (landing pages, not class types) | Provo CONFIRMED (site). Lehi CONFIRMED by Sam 2026-09-19 |
| 2 | Pottery Kickstart: 4 Week Course | course | 4 × 120 min | $200 | per wheel | no wheel sharing, ticket eligible. 10 lb clay, bisque + glaze firing included | CONFIRMED (site, both studios) |
| 3 | Guided Pottery Time | event | OPEN | 1 class ticket | per person | members only; free for Kickstart make-ups | ASSUMED |
| 4 | Kids Summer Camp | course | 4 days | $199 | per person | ages 8–17 | ASSUMED (site shows $199) |
| 5 | Group Event / Private Booking | event | OPEN | $375 flat | flat | private, never on the public schedule | ASSUMED |
| 6 | Workshop | event | per session | set per session | per person | tag `workshop`; ticket eligibility toggled per session | ASSUMED |
| 7 | Private Lesson | event | OPEN | non-member $55 · member $43 | per person | | ASSUMED |

Lehi youth courses on the live Lehi nav (CONFIRMED on site 2026-09-19, not in
the prompts' target list — see OPEN items):

| Class type | Kind | Price | Notes |
|---|---|---|---|
| Lehi After-School Pottery Course | course | $257 | 6 × 120 min, ages 8–17 |
| Lehi Homeschool Pottery Course | course | $257 | 6 × 120 min, ages 8–17 |

Member classes that exist on the schedule today and cost one ticket (kept,
members only, never sold as a drop-in): Pottery 101 (Clay Prep & Centering,
Pulling & Shaping, Trimming & Add-Ons, Glazing & Finishing), Member
Orientation, Member Event, Open Studio (Members Only). ASSUMED.

Dated cohorts ("Friday @ 1pm, April 3, 10, 17, 24") are **sessions of a
course, not class types**.

### 2.2 Piece charges (paid in studio after a Clay Together class)

| Item | Price | Unit | Status |
|---|---|---|---|
| 1 lb piece | $9.99 | each | CONFIRMED (site: $9.99–$14.99 per finished piece) |
| 1.5 lb piece | $12.99 | each | ASSUMED |
| 2 lb piece | $14.99 | each | CONFIRMED (site) |
| Piece over 2 lb | OPEN | each | OPEN |
| Add a handle | $1.50 | each | ASSUMED |
| Glazed by us | $7.99 | each | ASSUMED |
| Extra clay | $3.00 | per lb | ASSUMED |

## 3. Firing, clay, packs, shipping

### 3.1 Member firing

| Item | Price | Unit | Status |
|---|---|---|---|
| Glaze firing | $1.00 | per lb | ASSUMED |
| Glaze firing, oversize (over 12 in at widest point) | $1.75 | per lb | ASSUMED |
| Minimum charge | $1.00 | per piece | ASSUMED |
| Bisque firing | $0.00 | — | members and enrolled students only. ASSUMED |

Rule: exact weight to 0.1 lb, rate × weight rounded to the cent, then the
per-piece minimum. Only members and enrolled students may use member firing.

### 3.2 Clay

| Item | Price | Unit | Status |
|---|---|---|---|
| B-Mix | $1.00 | per lb | ASSUMED |
| Speckled Buff | OPEN | per lb | OPEN — inactive |
| Charcoal | OPEN | per lb | OPEN — inactive |
| 10 lb and 25 lb bags of each clay | OPEN | each | OPEN — inactive |
| Clay sample pack | OPEN | each | OPEN — inactive |
| Recycled clay | $0.50 per lb | per lb | CONFIRMED by Sam 2026-09-12 (from the launch build; not in the prompts) |

### 3.3 Class packs

| Pack | Price | Status |
|---|---|---|
| 5 classes | $150 | ASSUMED |
| 10 classes | $270 | ASSUMED |
| 15 classes | $360 | ASSUMED |

Credits never expire and are not shareable.

### 3.4 Shipping

| Pieces | Price | Status |
|---|---|---|
| 1–2 pieces | $25 | ASSUMED |
| 3–4 pieces | $45 | ASSUMED |
| 5+ pieces | OPEN | OPEN |

## 4. Memberships

Sold **online only** until membership billing migrates from Momence on
**2026-10-25**. The POS never starts a subscription; it only looks a member up.
Existing customer subscriptions are not to be touched before that date.

### 4.1 Standard plans (public)

| Plan | Provo / month | Lehi / month | Tickets / period | Shelf | Status |
|---|---|---|---|---|---|
| Basic | $70 | $70 (needs confirmation) | 8 | none | Provo CONFIRMED (site) |
| Pro | $110 | $110 (needs confirmation) | 10 | half | Provo CONFIRMED (site) |
| Expert | $120 | $120 (needs confirmation) | 12 | full | Provo CONFIRMED (site) |

All include 24/6 studio access, clay and firing discounts, studio glazes,
workshops and member events. Ticket rollover: OPEN.

### 4.2 Lehi founding plans (public, capped)

| Plan | Price / month |
|---|---|
| Founding Basic | $55 |
| Founding Pro | $95 |
| Founding Expert | $105 |

Cap: **50 founding members in total across the three tiers**. The founding
rate is forfeited on cancel or freeze. ASSUMED.

### 4.3 Legacy plans (not public, not purchasable online or in POS, staff assignable)

| Plan | Price |
|---|---|
| Pro Legacy | $90 / month |
| Student Monthly | $60 / month |
| Basic Annual | $500 / year |

Tickets and shelf for legacy plans: OPEN.

### 4.4 Commitment terms

| Term | Joining fee | Retail discount | Perks |
|---|---|---|---|
| None (month to month) | $25 | — | — |
| 3 month | waived | 10% off retail | video library |
| 12 month | waived | 20% off retail | guest pass, video library, 1 month free |

### 4.5 Add-ons

| Add-on | Price |
|---|---|
| Guest pass | $25 / month; auto-included on 12 month commitments |

### 4.6 Freeze

Monthly fee: OPEN. Credit accrued per frozen month: OPEN. Freezing forfeits a
founding rate: yes (ASSUMED).

## 5. Gift cards and tax

- Gift cards never expire, are redeemable on anything, and allow a custom
  amount. They work as a tender in the POS and online. ASSUMED.
- Sales tax is calculated by **Stripe Tax**. Nothing computes tax by hand.
  Every product and category carries a Stripe tax code. CONFIRMED (launch build).

## 6. Discounts

| Discount | Value | Scope | How applied | Limit | Status |
|---|---|---|---|---|---|
| Staff | 10% | everything | staff applied | — | ASSUMED |
| 3 month commitment | 10% | retail only (never clay or firing) | automatic when that member is on the order | — | ASSUMED |
| 12 month commitment | 20% | retail only (never clay or firing) | automatic when that member is on the order | — | ASSUMED |
| Group event extras | 20% | pieces only | staff applied, only on orders tied to a group event | — | ASSUMED |
| Get Out Pass | one 1 lb piece free | pieces only | staff applied | once per customer per year; customer still pays the wheel reservation | ASSUMED |
| Free Wheel Experience coupon | 100% off one Clay Together wheel | classes | staff applied, requires a note | — | ASSUMED |
| KICKSTART50 | 50% off Pottery Kickstart | classes | promo code | start and end dates editable in admin | ASSUMED |
| GRAND30 | 30% off Lehi courses | classes | promo code | grand opening; dates OPEN | CONFIRMED on the live Lehi pages ("Use Code: Grand30") |

Promo codes must be fully manageable in admin; the client changes them often.

## 7. Policies

- Class pack credits never expire and are not shareable.
- Gift cards never expire.
- Founding rate is forfeited on cancel or freeze.
- A Clay Together wheel seats up to 2 people; a Kickstart wheel is not shared.
- Paid drop-ins cannot join a waitlist (a full session is not sold).

## 8. Not offered / internal (must never be sellable)

- **Busy Window** — an internal schedule block, not a class.
- **Free Pottery Wheel Experience** — a coupon (§6), not a class type.
- **90 Min Pottery Class** — stale; the experience is 120 minutes.
- **Date Night**, **Bachelorette** — tags and landing pages on Clay Together.
- One-off private bookings stored as class types (e.g. "Bree Goates - Kid's
  birthday parties", "Meredith's Group") — these are Group Event / Private
  Booking sessions.
- Momence mechanics: "Pay for Pottery Pieces", "Pottery Piece Pick Up!",
  "Studio Tour", "Orem Farmers Market".
- Seed/demo types: "Wheel Throwing 101", "Open Studio" ($15), "Hand Building
  Workshop".
- Cash payments.

## 9. OPEN items to send to the client

1. Lehi standard membership prices (seeded equal to Provo; need confirmation).
2. Ticket rollover rules for Basic / Pro / Expert.
3. Tickets and shelf allocation for the three legacy plans.
4. Freeze: monthly fee and credit accrued per frozen month.
5. Price for a finished piece over 2 lb.
6. Prices for Speckled Buff, Charcoal, the 10 lb / 25 lb bags, and the sample pack.
7. Shipping for 5 or more pieces.
8. Durations for Guided Pottery Time, Group Event and Private Lesson.
9. Are the Lehi After-School and Homeschool courses ($257, live on the site)
   part of the ongoing catalog, and do they take class tickets?
10. GRAND30 end date, and whether it applies to Kickstart only or all Lehi courses.
11. Kids Summer Camp: the prompts say ages 8–17, the site says 10–17.
12. Does Kickstart past the 15 lb clay allowance get charged, and at what rate?
