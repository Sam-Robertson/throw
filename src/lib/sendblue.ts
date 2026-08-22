const SENDBLUE_BASE_URL = "https://api.sendblue.com";

export const SENDBLUE_FROM_NUMBER = process.env.SENDBLUE_FROM_NUMBER!;

function sendblueHeaders() {
  return {
    "Content-Type": "application/json",
    "sb-api-key-id": process.env.SENDBLUE_API_KEY!,
    "sb-api-secret-key": process.env.SENDBLUE_API_SECRET!,
  };
}

export interface SendblueSendResult {
  message_handle: string;
  status: string;
  service?: "iMessage" | "SMS";
  was_downgraded?: boolean;
  error_code?: string | null;
  error_message?: string | null;
}

// POST https://api.sendblue.com/api/send-message — sends over iMessage when
// available, falls back to SMS. `to`/SENDBLUE_FROM_NUMBER must be E.164
// (e.g. "+18015550100").
export async function sendSendblueMessage(
  to: string,
  content: string,
): Promise<SendblueSendResult> {
  const res = await fetch(`${SENDBLUE_BASE_URL}/api/send-message`, {
    method: "POST",
    headers: sendblueHeaders(),
    body: JSON.stringify({
      number: to,
      from_number: SENDBLUE_FROM_NUMBER,
      content,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.message ?? data?.error_message ?? `Sendblue request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as SendblueSendResult;
}
