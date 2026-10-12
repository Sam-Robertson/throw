import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { isPlaceholderEmail } from "@/lib/walkinEmail";
import { formatMountainTime } from "@/lib/timezone";
import { formatCents } from "@/lib/membershipLifecycle";

const DEFAULT_FROM = "Throw Art Studio <hello@throwartstudio.com>";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sends one plain transactional email and reports whether it went. Never
 * throws: the membership change has already happened by the time this runs,
 * and a mail problem must not undo it.
 */
async function send({ to, subject, lines }: { to: string; subject: string; lines: string[] }): Promise<boolean> {
  if (isPlaceholderEmail(to)) return false;
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[membership email] RESEND_API_KEY is not set — "${subject}" not sent.`);
    return false;
  }
  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM,
      to,
      subject,
      text: lines.join("\n\n"),
      html: lines.map((l) => `<p>${escapeHtml(l)}</p>`).join(""),
    });
    if (error) {
      console.error(`[membership email] Resend rejected "${subject}":`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[membership email] Failed to send "${subject}":`, err);
    return false;
  }
}

/** The confirmation the "Membership paused" page promises. */
export async function sendMembershipPausedEmail({
  membershipId,
  pausedAt,
  resumesAt,
  terms,
}: {
  membershipId: string;
  pausedAt: Date;
  resumesAt: Date;
  terms: { monthlyFeeCents: number; creditCentsPerFrozenMonth: number };
}): Promise<boolean> {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: { user: { select: { email: true, name: true } }, plan: { select: { name: true } } },
  });
  if (!membership) return false;
  const first = membership.user.name?.split(" ")[0];
  return send({
    to: membership.user.email,
    subject: "Your Throw membership is paused",
    lines: [
      `Hi${first ? ` ${first}` : ""},`,
      `Your ${membership.plan.name} membership pauses on ${formatMountainTime(pausedAt, "date")}. While it's paused you'll be billed ${formatCents(terms.monthlyFeeCents)} a month and earn ${formatCents(terms.creditCentsPerFrozenMonth)} of store credit for every paused month.`,
      `Normal billing resumes automatically on ${formatMountainTime(resumesAt, "date")}. You can restart sooner any time from My membership.`,
      "Store credit isn't cash: no refunds, it can't go toward dues, and if you cancel while paused it's gone.",
      "See you back at the wheel,\nThrow Art Studio",
    ],
  });
}
