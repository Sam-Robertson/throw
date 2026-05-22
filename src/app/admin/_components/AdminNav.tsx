"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

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
  { href: "/admin/landing-pages", label: "Landing Pages" },
  { href: "/admin/reports", label: "Reports" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-0.5 p-2">
      {NAV.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
