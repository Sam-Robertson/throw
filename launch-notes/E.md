# Workstream E: POS drop-in bookings, Stripe Tax, clay & firing, gift card codes

## Built

**Drop-ins book a real session**
- `GET /api/pos/catalog` now returns `upcomingSessions`: sessions at the order's location from today (Mountain Time) through the next 6 days, with seats left.
- The Drop-ins tab (`src/app/admin/pos/_components/CatalogPanel.tsx`) shows a day picker (default: today) and the session list. Full sessions, and sessions already in the cart, are disabled.
- `POST /api/pos/orders/[id]/items` with `DROP_IN` requires `metadata.studioSessionId`, and checks the session:
  - it's at the order's location (400 `WRONG_LOCATION`)
  - it isn't cancelled (409 `SESSION_CANCELLED`)
  - it isn't already in the order (409 `ALREADY_IN_ORDER`)
  - it has a seat (409 `SESSION_FULL`)
  - the customer, if attached, isn't already booked (409 `ALREADY_BOOKED`)
- The item keeps `refId` = sessionTypeId and stores `metadata.studioSessionId` (and `startsAt`). Quantity is fixed at 1.

**Payment gate**
- `checkOrderPayable()` in `src/lib/pos.ts` runs in every payment-start route: cash, card-manual, card-terminal, gift-card and comp.
- It returns 400 `{ error: "CUSTOMER_REQUIRED", message }` when the order has a drop-in line and no customer. Before the first payment it also returns 409 `SESSION_FULL` / `ALREADY_BOOKED` / `SESSION_CANCELLED`.
- The terminal UI (CartPanel and PaymentSheet) blocks Charge with a clear message when a customer is required.

**Completion (`maybeCompletePosOrder`)**
- Each DROP_IN line creates a Booking: CONFIRMED, source DROP_IN, `amountPaidCents` = line total, `posOrderItemId` = line id. The unique column makes it idempotent.
- It then fires `booking/confirmed` through `sendInngestEvent`, so the existing confirmation SMS and 24h reminder apply.
- If the session filled up between the payment check and completion, the booking is WAITLIST and a note is added to the order (shown on the success screen). Completion never fails after money is taken.

**Memberships tab removed** from CatalogPanel. Server-side MEMBERSHIP handling is unchanged.

**Stripe Tax**
- `src/lib/stripeTax.ts` wraps `stripe.tax.calculations.create`:
  - It sends the location's structured address as the customer address, with `address_source: "shipping"`.
  - It sends one line per taxable item, `tax_behavior: "exclusive"`. Tips are never sent.
  - It uses `expand: ["line_items"]` to store tax per item.
- `repriceOrder()` in `src/lib/pos.ts` runs after every item add, change or delete. It stores `PosOrderItem.taxCents`, `PosOrder.stripeTaxCalculationId`, and the total tax in `PosOrder.taxCents`.
- `calculateOrderTotals` stays pure: tax is passed in.
- On completion, `stripe.tax.transactions.createFromCalculation` runs with reference `pos-order-<orderNumber>` and an idempotency key.
- **Fallback:** zero tax plus a `taxWarning` in the item-change response, which the terminal shows as an amber banner. This covers four cases: `Location.taxEnabled` is false, the address is incomplete, Stripe Tax is inactive, or any Stripe error. Checkout is never blocked.
- `src/config/taxCodes.ts`:
  - RETAIL and CUSTOM (including clay and firing): `txcd_99999999`.
  - GIFT_CARD, DROP_IN and MEMBERSHIP: null (nontaxable).
  - All marked as placeholders pending JP.
- The cart shows a Tax line when tax is above 0.

**Clay & firing tab**
- New tab (`src/app/admin/pos/_components/FiringPanel.tsx`), backed by `src/config/firingPrices.ts`, whose price table and quote function are both flagged for JP.
- **Tiers:**
  - member under 12 in ($1.00/lb)
  - member over 12 in ($1.75/lb)
  - experience, flat per piece: ≤1 lb $9.99, ≤1.5 lb $12.99, ≤2 lb $14.99, over 2 lb refused with instructions
  - course: $0 up to 15 lb; over is refused
  - recycled clay: $0.50/lb in 1, 5, 10, 15 and 25 lb bags
- Adds a CUSTOM line with `metadata { kind: "FIRING", tier, weightOz, count, pieceIds? }`.
- The server recomputes the price from the metadata; it never trusts the client price.
- If the order has a customer, the tab lists their INTAKE pieces from `GET /api/admin/pieces?userId=…&status=INTAKE`. On completion, the selected pieces get `weightOz`, `chargedCents` and `posOrderItemId`.
- Quantity is locked on firing lines, as it is on drop-ins.
- The Custom tab's placeholder is now "Item name" instead of "Firing fee".

**Gift card codes**
- On completion, the codes generated for each GIFT_CARD line are stored on the line as `metadata.giftCardCodes`.
- Every completion response includes the order's items, so the codes come back in `order.items[].metadata.giftCardCodes`.
- The terminal success view shows them large and monospaced.

**`checkPermission` gets the location** (third argument) in every POS route that has one:
- Order-scoped routes check it once the order is loaded.
- Catalog, readers, drawer open/current/close/history and orders POST use the query or body `locationId`.
- Orders GET also scopes STAFF to their assigned locations via `resolveLocationScope`.

**Other**
- Voiding a COMPLETED order now cancels the drop-in bookings it created and fires `booking/cancelled`.
- The order PATCH refuses to change the customer (409 `CUSTOMER_LOCKED`) once a drop-in order has a payment.
- Every POS order response now includes `customer`. Previously, item and tip responses dropped it, so the cart lost the attached customer's name until reload.
- `scripts/terminal-e2e.ts` now also covers:
  - CUSTOMER_REQUIRED is refused
  - a DROP_IN line produces the expected Booking
  - re-settling creates no second booking
- The script creates and removes its own customer, session type and session, and prints the database it's connected to.

## Verified

- `npm run terminal:e2e` against the local `throw_launch_dev` database (Stripe test mode, simulated WisePOS E): **ALL CHECKS PASSED**. That covers the payment, tip reconciliation, completion, and a drop-in Booking with the right status, source, customer, session and amount. It also confirmed idempotent re-settle and that the missing-customer block works. Tax fell back to $0 with the warning (see below).
- `quoteFiring` spot-checked across every tier, including the refused cases (over 2 lb, over 15 lb, a clay bag that doesn't exist).
- `npx tsc --noEmit`: no errors in E files. `npx eslint` on E files: clean.

## Could not verify

- **A real Stripe Tax calculation.** Stripe Tax is **not active on the Stripe account, even in test mode**. A direct call returns `stripe_tax_inactive`. The request parameters match the SDK types, but no calculation, per-line tax, or `createFromCalculation` has run against Stripe. Once Tax is activated (with a Utah registration), re-run `npm run terminal:e2e`: the order line prints the tax amount, and the warning should disappear.
- **The terminal UI.** No dev server was run (not allowed in this phase), so the Drop-ins day picker, the Clay & firing tab, the tax banner and the gift card code display are type-checked but not clicked through.
- **The piece picker in the Clay & firing tab.** It depends on Workstream D's `GET /api/admin/pieces?userId=` (and `&status=INTAKE`). It accepts either a bare array or `{ pieces: [...] }` and filters to INTAKE on the client. Untested against D's real route.
- **Writing firing charges to Piece rows at completion.** The code path wasn't exercised; the e2e has no piece.

## Judgment calls

- **Drop-in quantity is fixed at 1**, and a session can appear once per order. A Booking is one seat for one user (`posOrderItemId` is unique), and a POS drop-in books the order's customer. A second person means a second order with that person as the customer.
- **The capacity re-check runs only before the first payment.** On a split payment, refusing the second leg would strand a half-paid order. If a session fills between legs, completion creates a WAITLIST booking and adds an order note instead.
- **Stripe Tax is recalculated on item changes only** (add, quantity/discount change, delete), not on tip or customer changes, since those don't change tax. `recalculateOrderTotals` sums the stored per-line tax, so tip-only updates and Terminal settlement make no Stripe call. The warning banner therefore updates only on item changes and resets on a new or resumed order.
- **In-person tax address.** The studio's own structured address is sent as the customer address, with `address_source: "shipping"`.
- **Firing lines covering several pieces.** When one firing line is attached to several Piece rows, `weightOz` and `chargedCents` are split evenly, with the remainder on the oldest piece.
- **What the weight field means per tier.**
  - Experience: weight per piece. Price = band × count.
  - Member and course: total weight. The count is recorded but not priced.
  - Clay: count = number of bags.
- **The course 15 lb allowance is checked per weigh-in only.** Nothing tracks a student's running total across the course.
- **$0-only orders.** An order made up only of $0 lines (e.g. a course firing for the record) can't be completed, because no payment route accepts $0. Add the $0 line to an order that has other items. This didn't seem worth widening the payment routes for.
- **POS revenue in reports.** The mirrored `Payment` row for a POS order is still a single `type: OTHER` row for the whole order. A POS drop-in's revenue shows as "other" in Revenue reports, not "drop-in". Splitting it is out of E's scope.
- **Voiding a completed order doesn't reverse the Stripe Tax transaction.** No transaction id is stored, and void also doesn't refund money. It does cancel the drop-in bookings the order created. Firing charges written to pieces aren't reverted either.
- **Orders GET scoping.** Beyond passing `locationId` to `checkPermission`, the order-history list is scoped to STAFF's assigned locations via `resolveLocationScope`, so Lehi staff don't see Provo orders.
- **STAFF can't use the POS yet.** The three existing STAFF roles have no `canUsePos` key, so today only ADMIN can use the POS. That's role configuration, not code; assign it in Roles & Permissions.

## Cross-workstream edits needed

**1. `src/inngest/functions.ts` (Workstream G / integration): put gift card codes and tax on the POS receipt.**

In `sendPosReceipt`, add to the imports:

```ts
import { formatMoney, metadataObject } from "@/lib/pos";
```

(replacing the existing `import { formatMoney } from "@/lib/pos";`).

Replace the `lines` construction with:

```ts
        const lines = order.items
          .map((i) => {
            const line = `  ${i.quantity}x ${i.name} — ${formatMoney(i.totalCents)}`;
            const raw = metadataObject(i.metadata).giftCardCodes;
            const codes = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
            return codes.length > 0
              ? `${line}\n    Gift card code${codes.length > 1 ? "s" : ""}: ${codes.join(", ")}`
              : line;
          })
          .join("\n");
```

and add a tax line after the discount line in `body`:

```ts
          order.taxCents > 0 ? `Tax: ${formatMoney(order.taxCents)}` : null,
```

For the SMS fallback (customer has no email), append the codes so a phone-only buyer still gets them:

```ts
      const giftCardCodes = order.items.flatMap((i) => {
        const raw = metadataObject(i.metadata).giftCardCodes;
        return Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
      });
      await sendSms({
        to: order.customer.phone!,
        message:
          `Throw Art Studio receipt #${order.orderNumber}. Total ${formatMoney(order.totalCents)}.` +
          (giftCardCodes.length > 0 ? ` Gift card code${giftCardCodes.length > 1 ? "s" : ""}: ${giftCardCodes.join(", ")}.` : "") +
          " Thanks!",
        userId: order.customer.id,
        kind: "transactional",
      });
```

**2. For Workstream D (information only, no edit needed).** POS drop-in bookings fire `booking/confirmed` at completion, exactly like online drop-ins, so any session-end piece prompt keyed off `booking/confirmed` covers them.

**3. For Workstream D (API contract).** The Clay & firing tab calls `GET /api/admin/pieces?userId=<id>&status=INTAKE` and reads `id`, `description`, `pieceCount`, `groupName`, `createdAt` and `status` from either `[...]` or `{ pieces: [...] }`.
