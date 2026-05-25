import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const EMAIL_VARS = `Available variables: {{customer_name}}, {{customer_email}}, {{instructor_name}}, {{appointment_date}}, {{appointment_time}}, {{appointment_type}}, {{studio_name}}, {{studio_address}}, {{studio_phone}}, {{payment_link}}, {{penalty_amount}}, {{cancellation_reason}}`;

const SMS_VARS = `Available variables: {{customer_name}}, {{instructor_name}}, {{appointment_date}}, {{appointment_time}}, {{appointment_type}}, {{studio_name}}, {{studio_phone}}`;

const DEFAULT_TEMPLATES = [
  // ── EMAIL ─────────────────────────────────────────────────────────────
  {
    channel: "email",
    trigger: "appointment_payment_link_inperson",
    name: "Appointment (in-person) — Send payment link",
    description: "Sent to customers to collect payment for an in-person appointment.",
    subject: "Complete your booking — {{studio_name}}",
    body: `Hi {{customer_name}},

Your appointment at {{studio_name}} is reserved for {{appointment_date}} at {{appointment_time}} (in-person at {{studio_address}}).

To confirm your spot, please complete payment using the secure link below:

{{payment_link}}

If you have any questions, reply to this email or call us at {{studio_phone}}.

See you soon,
{{studio_name}}`,
  },
  {
    channel: "email",
    trigger: "appointment_payment_link_online",
    name: "Appointment (online) — Send payment link",
    description: "Sent to customers to collect payment for an online appointment.",
    subject: "Complete your booking — {{studio_name}}",
    body: `Hi {{customer_name}},

Your online appointment with {{instructor_name}} is reserved for {{appointment_date}} at {{appointment_time}}.

To confirm your spot, please complete payment using the secure link below:

{{payment_link}}

Once payment is received, you'll get a separate email with your session link.

Questions? Reply to this email or call us at {{studio_phone}}.

See you soon,
{{studio_name}}`,
  },
  {
    channel: "email",
    trigger: "appointment_cancellation_confirmation",
    name: "Appointment cancellation confirmation",
    description: "Sent when a customer or staff cancels an appointment.",
    subject: "Your appointment has been cancelled — {{studio_name}}",
    body: `Hi {{customer_name}},

We're confirming that your appointment at {{studio_name}} on {{appointment_date}} at {{appointment_time}} has been cancelled.

{{cancellation_reason}}

If you'd like to rebook, you can find available sessions at {{studio_name}}'s schedule or reply to this email and we'll help you find a new time.

Thank you,
{{studio_name}}`,
  },
  {
    channel: "email",
    trigger: "appointment_confirmation_inperson",
    name: "Appointment confirmation (in-person)",
    description: "Sent when an in-person appointment is confirmed and paid.",
    subject: "You're booked! — {{studio_name}}",
    body: `Hi {{customer_name}},

You're all set! Here are your appointment details:

  📍 {{studio_name}}
  📅 {{appointment_date}} at {{appointment_time}}
  🏺 {{appointment_type}}
  📌 {{studio_address}}

Please arrive 5–10 minutes early. If you need to cancel or reschedule, please do so at least 24 hours in advance.

Questions? Call us at {{studio_phone}} or reply to this email.

Can't wait to see you,
{{studio_name}}`,
  },
  {
    channel: "email",
    trigger: "appointment_confirmation_online",
    name: "Appointment confirmation (online)",
    description: "Sent when an online appointment is confirmed and paid.",
    subject: "You're booked! Your online session details — {{studio_name}}",
    body: `Hi {{customer_name}},

Your online session with {{instructor_name}} is confirmed!

  📅 {{appointment_date}} at {{appointment_time}}
  🏺 {{appointment_type}}

Your session link will be sent 30 minutes before your appointment. Make sure you're in a space with a good internet connection.

If you need to cancel or reschedule, please do so at least 24 hours in advance.

Questions? Reply to this email or call {{studio_phone}}.

See you online,
{{studio_name}}`,
  },
  {
    channel: "email",
    trigger: "appointment_late_cancel_penalty_charged",
    name: "Appointment late cancellation penalty charged",
    description: "Sent when a late cancellation fee is successfully charged.",
    subject: "Late cancellation fee charged — {{studio_name}}",
    body: `Hi {{customer_name}},

Because your appointment on {{appointment_date}} was cancelled less than 24 hours before the session, a late cancellation fee of {{penalty_amount}} has been charged to your card on file.

We understand life happens — if you have questions about this charge, please reply to this email or call us at {{studio_phone}}.

Thank you for understanding,
{{studio_name}}`,
  },
  {
    channel: "email",
    trigger: "appointment_late_cancel_penalty_failed",
    name: "Appointment late cancellation penalty charge failed",
    description: "Sent when the late cancellation fee charge fails.",
    subject: "Action required: Late cancellation fee — {{studio_name}}",
    body: `Hi {{customer_name}},

We attempted to charge a late cancellation fee of {{penalty_amount}} for your missed appointment on {{appointment_date}}, but the charge was unsuccessful.

Please update your payment method and contact us at {{studio_phone}} or reply to this email so we can resolve this.

Thank you,
{{studio_name}}`,
  },
  {
    channel: "email",
    trigger: "appointment_no_show_penalty_charged",
    name: "Appointment no-show penalty charged",
    description: "Sent when a no-show fee is successfully charged.",
    subject: "No-show fee charged — {{studio_name}}",
    body: `Hi {{customer_name}},

We missed you at your appointment on {{appointment_date}} at {{appointment_time}}! Because you didn't show up and didn't cancel in advance, a no-show fee of {{penalty_amount}} has been charged to your card on file.

We'd love to see you next time. Reply to this email if you have questions.

{{studio_name}}`,
  },
  {
    channel: "email",
    trigger: "appointment_no_show_penalty_failed",
    name: "Appointment no-show penalty charge failed",
    description: "Sent when the no-show fee charge fails.",
    subject: "Action required: No-show fee — {{studio_name}}",
    body: `Hi {{customer_name}},

We attempted to charge a no-show fee of {{penalty_amount}} for your appointment on {{appointment_date}}, but the charge was unsuccessful.

Please update your payment method and contact us at {{studio_phone}} so we can resolve this.

Thank you,
{{studio_name}}`,
  },

  // ── SMS ───────────────────────────────────────────────────────────────
  {
    channel: "sms",
    trigger: "sms_appointment_request_cancelled",
    name: "Appointment request for confirmation — canceled",
    description: "SMS sent to customer when their appointment request is canceled.",
    subject: null,
    body: `Hi {{customer_name}}, your appointment request at {{studio_name}} for {{appointment_date}} at {{appointment_time}} has been canceled. Questions? Call {{studio_phone}}.`,
  },
  {
    channel: "sms",
    trigger: "sms_appointment_request_created",
    name: "Appointment request for confirmation — created",
    description: "SMS sent to customer confirming their appointment request was received.",
    subject: null,
    body: `Hi {{customer_name}}, your request for {{appointment_type}} on {{appointment_date}} at {{appointment_time}} has been received by {{studio_name}}. We'll confirm shortly!`,
  },
  {
    channel: "sms",
    trigger: "sms_appointment_instructor_cancellation",
    name: "Appointment reservation — instructor cancellation",
    description: "SMS sent to instructor when their appointment is canceled.",
    subject: null,
    body: `Hi {{instructor_name}}, your appointment with {{customer_name}} on {{appointment_date}} at {{appointment_time}} has been canceled. — {{studio_name}}`,
  },
  {
    channel: "sms",
    trigger: "sms_appointment_instructor_confirm_inperson",
    name: "Appointment reservation — instructor confirmation (in-person)",
    description: "SMS sent to instructor confirming an in-person appointment.",
    subject: null,
    body: `Hi {{instructor_name}}, you have a new in-person appointment: {{customer_name}} on {{appointment_date}} at {{appointment_time}} at {{studio_name}}. — {{studio_name}}`,
  },
  {
    channel: "sms",
    trigger: "sms_appointment_instructor_confirm_online",
    name: "Appointment reservation — instructor confirmation (online)",
    description: "SMS sent to instructor confirming an online appointment.",
    subject: null,
    body: `Hi {{instructor_name}}, you have a new online appointment: {{customer_name}} on {{appointment_date}} at {{appointment_time}}. Check your email for the session link. — {{studio_name}}`,
  },
  {
    channel: "sms",
    trigger: "sms_appointment_waitlist_inperson",
    name: "Appointment SMS confirmation from waitlist (in-person)",
    description: "SMS sent when a customer moves off the waitlist for an in-person session.",
    subject: null,
    body: `Great news, {{customer_name}}! A spot opened up — you're confirmed for {{appointment_type}} at {{studio_name}} on {{appointment_date}} at {{appointment_time}}. See you there!`,
  },
  {
    channel: "sms",
    trigger: "sms_appointment_waitlist_online",
    name: "Appointment SMS confirmation from waitlist (online)",
    description: "SMS sent when a customer moves off the waitlist for an online session.",
    subject: null,
    body: `Great news, {{customer_name}}! You're confirmed for your online {{appointment_type}} on {{appointment_date}} at {{appointment_time}}. Check your email for the session link. — {{studio_name}}`,
  },
  {
    channel: "sms",
    trigger: "sms_appointment_reminder_inperson",
    name: "Appointment SMS reminder (in-person)",
    description: "Reminder SMS sent before an in-person appointment.",
    subject: null,
    body: `Hi {{customer_name}}, reminder: you have {{appointment_type}} at {{studio_name}} tomorrow, {{appointment_date}} at {{appointment_time}}. See you soon! Reply STOP to opt out.`,
  },
  {
    channel: "sms",
    trigger: "sms_appointment_reminder_online",
    name: "Appointment SMS reminder (online)",
    description: "Reminder SMS sent before an online appointment.",
    subject: null,
    body: `Hi {{customer_name}}, reminder: your online {{appointment_type}} with {{instructor_name}} is tomorrow, {{appointment_date}} at {{appointment_time}}. Check your email for the link. Reply STOP to opt out.`,
  },
];

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let created = 0;
  let skipped = 0;

  for (const t of DEFAULT_TEMPLATES) {
    const existing = await prisma.transactionalTemplate.findFirst({
      where: { trigger: t.trigger, channel: t.channel },
    });
    if (existing) { skipped++; continue; }

    await prisma.transactionalTemplate.create({
      data: {
        name: t.name,
        description: t.description,
        trigger: t.trigger,
        channel: t.channel,
        subject: t.subject ?? null,
        body: t.body,
        isActive: true,
      },
    });
    created++;
  }

  return NextResponse.json({
    message: `Seeded ${created} template${created !== 1 ? "s" : ""}. ${skipped} already existed.`,
    created,
    skipped,
  });
}

// Export vars so the page can display them
export { EMAIL_VARS, SMS_VARS };
