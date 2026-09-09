import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ClassPage } from '@/components/site/ClassPage';
import { CLASS_PAGES, getClassPage } from '@/content/classes';

export function generateStaticParams() {
  return CLASS_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getClassPage(slug);
  if (!page) return {};
  return { title: `${page.title} — Throw`, description: page.intro };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getClassPage(slug);
  if (!page) notFound();
  return <ClassPage page={page} />;
}
