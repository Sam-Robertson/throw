import { twilioClient, TWILIO_PHONE } from "@/lib/twilio";
import { prisma } from "@/lib/prisma";

export function interpolateTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function sendSms({
  to,
  message,
  userId,
  automationId,
}: {
  to: string;
  message: string;
  userId: string;
  automationId?: string;
}): Promise<void> {
  let twilioSid: string | undefined;
  let status = "sent";

  try {
    if (process.env.NODE_ENV === "production") {
      const result = await twilioClient.messages.create({
        body: message,
        from: TWILIO_PHONE,
        to,
      });
      twilioSid = result.sid;
    } else {
      console.log("[SMS]", to, message);
    }
  } catch (err) {
    status = "failed";
    console.error("[SMS] Failed to send:", err);
  }

  await prisma.smsLog.create({
    data: { userId, toPhone: to, message, twilioSid, status, automationId },
  });
}
