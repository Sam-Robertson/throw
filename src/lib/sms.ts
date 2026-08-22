import { sendSendblueMessage } from "@/lib/sendblue";
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
  kind,
}: {
  to: string;
  message: string;
  userId: string;
  automationId?: string;
  // "transactional" sends (booking/membership/receipt confirmations, admin
  // test sends, inbox replies) go out unconditionally. "marketing" is here
  // as the future home for a canSendMarketing() consent check before send —
  // that check doesn't exist yet (see src/lib/consent.ts), so today this
  // only affects the SmsLog audit trail, not delivery.
  kind: "transactional" | "marketing";
}): Promise<{ ok: boolean; providerMessageId?: string; error?: string }> {
  let providerMessageId: string | undefined;
  let providerService: string | undefined;
  let status = "sent";
  let error: string | undefined;

  try {
    if (process.env.NODE_ENV === "production") {
      const result = await sendSendblueMessage(to, message);
      providerMessageId = result.message_handle;
      providerService = result.service;
    } else {
      console.log("[SMS]", to, message);
    }
  } catch (err) {
    status = "failed";
    error = err instanceof Error ? err.message : "Unknown error";
    console.error("[SMS] Failed to send:", err);
  }

  await prisma.smsLog.create({
    data: {
      userId,
      toPhone: to,
      message,
      providerMessageId,
      providerService,
      status,
      kind,
      automationId,
    },
  });

  return { ok: status === "sent", providerMessageId, error };
}
