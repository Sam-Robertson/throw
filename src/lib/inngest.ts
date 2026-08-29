import { Inngest, type EventPayload } from "inngest";

export const inngest = new Inngest({ id: "throw-studio" });

// Event payload types used across the app
export type BookingEventData = {
  bookingId: string;
  userId: string;
  studioSessionId: string;
};
export type MembershipEventData = { membershipId: string; userId: string };

// inngest.send() throws synchronously when INNGEST_EVENT_KEY isn't
// configured (it always runs in "cloud" mode unless explicitly told
// otherwise). That's currently the case in production, which meant every
// caller — booking create/cancel, membership pause, the Stripe webhook,
// POS receipts — was failing its whole request after already committing
// the real database change. Notification delivery failing shouldn't take
// the primary action down with it, so every call site should go through
// this instead of calling inngest.send() directly.
export async function sendInngestEvent(payload: EventPayload): Promise<void> {
  try {
    await inngest.send(payload);
  } catch (err) {
    console.error(`Failed to send Inngest event "${payload.name}":`, err);
  }
}
