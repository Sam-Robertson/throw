import NextLink from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * "← Parent page" link that sits above a page title. Every page that is a
 * step down from another (a form, a detail, a report) shows one, so there is
 * always a way back besides the browser button. Works in MUI and Tailwind
 * pages alike (the colour tokens are global) and is hidden when printing.
 *
 * Label it with where it goes ("Pieces", "Dashboard"), not "Back".
 */
export function BackLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <NextLink
      href={href}
      className={`mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden ${className}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {children}
    </NextLink>
  );
}
