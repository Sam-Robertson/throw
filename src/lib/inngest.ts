import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "throw-studio" });

// Event payload types used across the app
export type BookingEventData = {
  bookingId: string;
  userId: string;
  studioSessionId: string;
};
export type MembershipEventData = { membershipId: string; userId: string };
