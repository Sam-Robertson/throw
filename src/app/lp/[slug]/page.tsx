import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await prisma.landingPage.findUnique({ where: { slug } });
  if (!page || !page.isActive) return { title: "Not Found" };
  return { title: page.title };
}

export default async function LandingPageRoute({ params }: Props) {
  const { slug } = await params;
  const page = await prisma.landingPage.findUnique({ where: { slug } });
  if (!page || !page.isActive) notFound();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero image */}
      {page.heroImageUrl && (
        <div className="w-full overflow-hidden" style={{ maxHeight: "500px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={page.heroImageUrl}
            alt={page.headline}
            className="h-full w-full object-cover"
            style={{ maxHeight: "500px" }}
          />
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight">
          {page.headline}
        </h1>

        {page.subheadline && (
          <p className="mb-8 text-xl text-muted-foreground">{page.subheadline}</p>
        )}

        {page.bodyHtml && (
          <div
            className="mb-12 space-y-4 text-base leading-relaxed [&_a]:underline [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
          />
        )}

        <a
          href={page.ctaUrl}
          className="inline-block rounded-md bg-primary px-8 py-3 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {page.ctaLabel}
        </a>
      </div>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p className="font-medium">Throw Pottery Studio</p>
      </footer>
    </div>
  );
}
