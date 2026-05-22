import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import {
  sendBookingConfirmation,
  sendBookingReminder,
  sendBookingCancellation,
  sendMembershipWelcome,
  sendMembershipPaused,
  scheduleBookingReminder,
} from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendBookingConfirmation,
    sendBookingReminder,
    sendBookingCancellation,
    sendMembershipWelcome,
    sendMembershipPaused,
    scheduleBookingReminder,
  ],
});
