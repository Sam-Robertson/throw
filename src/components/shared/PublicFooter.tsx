import Link from "next/link";
import { Circle } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="border-t bg-foreground text-background">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-3">
          {/* Left — wordmark + tagline */}
          <div>
            <p className="text-lg font-bold">Throw</p>
            <p className="mt-1 text-sm text-background/70">
              Pottery studio in Provo, Utah
            </p>
          </div>

          {/* Center — links */}
          <div className="flex flex-col gap-2">
            <Link
              href="/schedule"
              className="text-sm text-background/70 transition-colors hover:text-background"
            >
              Schedule
            </Link>
            <Link
              href="/membership"
              className="text-sm text-background/70 transition-colors hover:text-background"
            >
              Memberships
            </Link>
            <Link
              href="/about"
              className="text-sm text-background/70 transition-colors hover:text-background"
            >
              About
            </Link>
            <Link
              href="/login"
              className="text-sm text-background/70 transition-colors hover:text-background"
            >
              Login
            </Link>
          </div>

          {/* Right — social */}
          <div className="flex items-start gap-3">
            <a
              href="#"
              title="Instagram — coming soon"
              aria-label="Instagram (coming soon)"
              className="text-background/50 transition-colors hover:text-background"
            >
              <Circle className="h-5 w-5" />
            </a>
          </div>
        </div>

        <div className="mt-10 border-t border-background/20 pt-6 text-center text-xs text-background/50">
          © 2025 Throw Art Studio. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
