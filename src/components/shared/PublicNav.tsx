"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Role } from "@prisma/client";

interface NavUser {
  name?: string | null;
  role: Role;
}

interface Props {
  user: NavUser | null;
}

const NAV_LINKS = [
  { href: "/schedule", label: "Schedule" },
  { href: "/membership", label: "Memberships" },
  { href: "/community", label: "Community" },
  { href: "/about", label: "About" },
];

const ACCOUNT_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/bookings", label: "My Bookings" },
  { href: "/membership/manage", label: "Manage Membership" },
  { href: "/account", label: "Account Settings" },
];

export function PublicNav({ user }: Props) {
  const [open, setOpen] = useState(false);

  const isStaffOrAdmin = user?.role === "STAFF" || user?.role === "ADMIN";

  function handleSignOut() {
    setOpen(false);
    void signOut({ callbackUrl: "/" });
  }

  return (
    <nav className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Wordmark */}
        <Link href="/" className="text-xl font-bold tracking-tight">
          Throw
        </Link>

        {/* Center links — desktop */}
        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right actions — desktop */}
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  My Account
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {ACCOUNT_LINKS.map((l) => (
                  <DropdownMenuItem key={l.href} asChild>
                    <Link href={l.href}>{l.label}</Link>
                  </DropdownMenuItem>
                ))}
                {isStaffOrAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin">Admin Panel</Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => void signOut({ callbackUrl: "/" })}
                  className="text-destructive focus:text-destructive"
                >
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/membership">Join</Link>
              </Button>
            </>
          )}
        </div>

        {/* Hamburger — mobile */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <nav className="mt-6 flex flex-col gap-1">
                {NAV_LINKS.map((l) => (
                  <SheetClose key={l.href} asChild>
                    <Link
                      href={l.href}
                      className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      {l.label}
                    </Link>
                  </SheetClose>
                ))}

                <div className="my-3 h-px bg-border" />

                {user ? (
                  <>
                    {ACCOUNT_LINKS.map((l) => (
                      <SheetClose key={l.href} asChild>
                        <Link
                          href={l.href}
                          className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                        >
                          {l.label}
                        </Link>
                      </SheetClose>
                    ))}
                    {isStaffOrAdmin && (
                      <>
                        <div className="my-3 h-px bg-border" />
                        <SheetClose asChild>
                          <Link
                            href="/admin"
                            className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                          >
                            Admin Panel
                          </Link>
                        </SheetClose>
                      </>
                    )}
                    <div className="my-3 h-px bg-border" />
                    <button
                      onClick={handleSignOut}
                      className="rounded-md px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-accent"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <SheetClose asChild>
                      <Link
                        href="/login"
                        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                      >
                        Sign In
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        href="/membership"
                        className="rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Join
                      </Link>
                    </SheetClose>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
