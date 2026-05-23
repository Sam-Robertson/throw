"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/class-types", label: "Class Types" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/membership-plans", label: "Membership Plans" },
  { href: "/admin/memberships", label: "Memberships" },
  { href: "/admin/waivers", label: "Waivers" },
  { href: "/admin/automations", label: "Automations" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/tasks", label: "Tasks" },
  { href: "/admin/community", label: "Community" },
  { href: "/admin/landing-pages", label: "Landing Pages" },
  { href: "/admin/reports", label: "Reports" },
];

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Wordmark */}
        <Link href="/admin" className="shrink-0 text-xl font-bold tracking-tight">
          Throw{" "}
          <span className="font-normal text-muted-foreground">— Admin</span>
        </Link>

        {/* Nav links — desktop, horizontally scrollable */}
        <div className="mx-4 hidden flex-1 items-center gap-0.5 overflow-x-auto md:flex">
          {NAV.map(({ href, label, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right: View Site + mobile hamburger */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            View Site
          </Link>

          {/* Hamburger — mobile only */}
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Open admin navigation">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
                <nav className="mt-6 flex flex-col gap-1">
                  {NAV.map(({ href, label, exact }) => {
                    const active = exact
                      ? pathname === href
                      : pathname.startsWith(href);
                    return (
                      <SheetClose key={href} asChild>
                        <Link
                          href={href}
                          className={cn(
                            "rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
                            active && "bg-accent text-foreground",
                          )}
                          onClick={() => setOpen(false)}
                        >
                          {label}
                        </Link>
                      </SheetClose>
                    );
                  })}
                  <div className="my-3 h-px bg-border" />
                  <SheetClose asChild>
                    <Link
                      href="/"
                      className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={() => setOpen(false)}
                    >
                      View Site
                    </Link>
                  </SheetClose>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
