import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { formatMountainTime } from "@/lib/timezone";

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const authSession = await auth();
  if (!authSession?.user?.id) {
    redirect("/login");
  }

  const { session_id } = await searchParams;
  if (!session_id) {
    redirect("/schedule");
  }

  let checkoutSession: Awaited<
    ReturnType<typeof stripe.checkout.sessions.retrieve>
  >;
  try {
    checkoutSession = await stripe.checkout.sessions.retrieve(session_id);
  } catch {
    redirect("/schedule");
  }

  if (checkoutSession.payment_status !== "paid") {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="mb-2 text-2xl font-bold">Payment pending</h1>
        <p className="mb-6 text-muted-foreground">
          Your payment has not completed yet. Please try again or contact us if
          the problem persists.
        </p>
        <Link href="/schedule" className="underline underline-offset-4">
          Back to schedule
        </Link>
      </main>
    );
  }

  const { studioSessionId } = (checkoutSession.metadata ?? {}) as {
    userId?: string;
    studioSessionId?: string;
  };

  const paymentIntentId =
    typeof checkoutSession.payment_intent === "string"
      ? checkoutSession.payment_intent
      : (checkoutSession.payment_intent?.id ?? null);

  // Try to load the booking created by the webhook
  const booking = paymentIntentId
    ? await prisma.booking.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
        select: { id: true, status: true },
      })
    : null;

  // Load session details for the confirmation summary
  const studioSession = studioSessionId
    ? await prisma.studioSession.findUnique({
        where: { id: studioSessionId },
        include: {
          sessionType: {
            select: { name: true, durationMinutes: true },
          },
          instructor: { select: { name: true } },
        },
      })
    : null;

  const amountPaid = checkoutSession.amount_total ?? 0;

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-lg border bg-card p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-7 w-7 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-2xl font-bold">
          {booking?.status === "WAITLIST"
            ? "You're on the waitlist"
            : "Booking confirmed!"}
        </h1>

        <p className="mb-6 text-muted-foreground">
          {booking?.status === "WAITLIST"
            ? "Payment received. You've been added to the waitlist and will be notified if a spot opens."
            : "Payment received. Your spot is confirmed."}
        </p>

        {studioSession && (
          <dl className="mb-6 space-y-2 text-left text-sm">
            <div className="flex justify-between">
              <dt className="font-medium">Session</dt>
              <dd className="text-muted-foreground">
                {studioSession.sessionType.name}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-medium">Date &amp; time</dt>
              <dd className="text-muted-foreground">
                {formatMountainTime(studioSession.startsAt, "datetime")}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="font-medium">Duration</dt>
              <dd className="text-muted-foreground">
                {studioSession.sessionType.durationMinutes} min
              </dd>
            </div>
            {studioSession.instructor?.name && (
              <div className="flex justify-between">
                <dt className="font-medium">Instructor</dt>
                <dd className="text-muted-foreground">
                  {studioSession.instructor.name}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="font-medium">Amount paid</dt>
              <dd className="text-muted-foreground">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(amountPaid / 100)}
              </dd>
            </div>
          </dl>
        )}

        {!booking && (
          <p className="mb-6 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Your booking is being confirmed — check your dashboard in a moment.
          </p>
        )}

        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
