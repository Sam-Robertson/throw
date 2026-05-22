import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "About — Throw",
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-foreground px-4 py-20 text-background">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold sm:text-5xl">About Throw</h1>
          <p className="mt-4 text-lg text-background/70">
            Throw is a pottery studio in Provo, Utah offering open studio
            sessions, wheel throwing classes, hand building workshops, and
            memberships.
          </p>
        </div>
      </section>

      {/* What We Offer */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold">What We Offer</h2>
          <ul className="space-y-4">
            {[
              {
                title: "Open Studio",
                desc: "Drop in and work on your own projects during scheduled open studio sessions.",
              },
              {
                title: "Classes & Workshops",
                desc: "Wheel throwing and hand building classes for all skill levels.",
              },
              {
                title: "Memberships",
                desc: "Recurring memberships with unlimited studio access and priority booking.",
              },
              {
                title: "Private Events",
                desc: "Private studio rentals and group events — coming soon.",
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs text-background">
                  ✓
                </span>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Find Us */}
      <section className="bg-muted/40 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold">Find Us</h2>
          <div className="mb-4">
            <p className="font-semibold">Address</p>
            <p className="text-muted-foreground">Provo, Utah</p>
          </div>
          <div>
            <p className="mb-2 font-semibold">Hours</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
                (day) => (
                  <li key={day} className="flex gap-6">
                    <span className="w-24 shrink-0">{day}</span>
                    <span>See schedule for session times</span>
                  </li>
                ),
              )}
              <li className="flex gap-6">
                <span className="w-24 shrink-0">Sunday</span>
                <span>Closed</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="mb-3 text-2xl font-bold">
            Ready to get your hands dirty?
          </h2>
          <p className="mb-6 text-muted-foreground">
            Browse our upcoming sessions and book your spot today.
          </p>
          <Button size="lg" asChild>
            <Link href="/schedule">See the Schedule</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
