import { qrSvg } from "@/lib/qr";
import { PrintButton } from "./PrintButton";
import { BackLink } from "@/components/shared/BackLink";

/**
 * One printable poster: a heading, a QR code and the link it encodes.
 * Server component (draws the QR on the server). Print with the browser;
 * page breaks fall between posters.
 */
export async function QrPoster({
  title,
  subtitle,
  url,
  footnote,
}: {
  title: string;
  subtitle?: string;
  url: string;
  footnote?: string;
}) {
  const svg = await qrSvg(url);
  return (
    <section
      className="flex flex-col items-center justify-center gap-6 border-b p-10 text-center print:h-screen print:break-after-page print:border-0"
      style={{ minHeight: 640 }}
    >
      <h1 className="text-4xl font-bold">{title}</h1>
      {subtitle && <p className="max-w-md text-lg text-muted-foreground">{subtitle}</p>}
      <div
        className="w-64 max-w-full rounded-lg bg-white p-4 shadow-sm print:shadow-none [&>svg]:h-auto [&>svg]:w-full"
        aria-label={`QR code for ${url}`}
        role="img"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="break-all font-mono text-sm text-muted-foreground">{url}</p>
      {footnote && <p className="max-w-md text-sm text-muted-foreground">{footnote}</p>}
    </section>
  );
}

/** Wraps posters with a Print button that hides itself on paper. */
export function PrintSheet({ children, backHref, backLabel }: { children: React.ReactNode; backHref: string; backLabel: string }) {
  return (
    <main className="mx-auto max-w-3xl bg-background">
      <div className="flex items-center justify-between gap-2 p-4 print:hidden">
        <BackLink href={backHref} className="mb-0">{backLabel}</BackLink>
        <PrintButton />
      </div>
      {children}
    </main>
  );
}
