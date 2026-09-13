import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import {
  sendBookingConfirmation,
  sendBookingReminder,
  sendBookingCancellation,
  sendMembershipWelcome,
  sendMembershipPaused,
  scheduleBookingReminder,
  sendPosReceipt,
} from "@/inngest/functions";
import { schedulePieceIntakePrompt, logPieceIntakePrompt } from "@/inngest/pieces";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendBookingConfirmation,
    sendBookingReminder,
    sendBookingCancellation,
    sendMembershipWelcome,
    sendMembershipPaused,
    scheduleBookingReminder,
    sendPosReceipt,
    schedulePieceIntakePrompt,
    logPieceIntakePrompt,
  ],
});
