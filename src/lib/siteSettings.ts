import { prisma } from '@/lib/prisma';
import { ANNOUNCEMENT } from '@/content/site';

/**
 * The announcement bar under the site nav ("40% off 4 week courses"). Staff
 * switch it on and off and change the words from Studio set-up → Site
 * banner, so a promo never waits on a deploy. Until it is saved once, the
 * bar shows the default from src/content/site.ts.
 */

export const ANNOUNCEMENT_KEY = 'announcement';

export interface Announcement {
  enabled: boolean;
  text: string;
  /** Where the bar links to, if anywhere (a path on this site or a full URL). */
  href: string | null;
}

export const DEFAULT_ANNOUNCEMENT: Announcement = { enabled: true, text: ANNOUNCEMENT, href: null };

export function parseAnnouncement(value: unknown): Announcement {
  if (typeof value !== 'object' || value === null) return DEFAULT_ANNOUNCEMENT;
  const v = value as Record<string, unknown>;
  const text = typeof v.text === 'string' ? v.text.trim().slice(0, 120) : '';
  const href = typeof v.href === 'string' && v.href.trim() ? v.href.trim().slice(0, 500) : null;
  return { enabled: v.enabled === true && text.length > 0, text, href };
}

export async function getAnnouncement(): Promise<Announcement> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: ANNOUNCEMENT_KEY } });
    return row ? parseAnnouncement(row.value) : DEFAULT_ANNOUNCEMENT;
  } catch (err) {
    // Before the migration has run (or if the database is unreachable) the
    // site still renders, with the default bar.
    console.error('[siteSettings] could not read the announcement:', err);
    return DEFAULT_ANNOUNCEMENT;
  }
}

/** The bar as the nav shows it: null when switched off. */
export async function getAnnouncementBar(): Promise<{ text: string; href: string | null } | null> {
  const a = await getAnnouncement();
  return a.enabled ? { text: a.text, href: a.href } : null;
}

export async function saveAnnouncement(input: Announcement): Promise<Announcement> {
  const value = { enabled: input.enabled, text: input.text, href: input.href };
  const row = await prisma.siteSetting.upsert({
    where: { key: ANNOUNCEMENT_KEY },
    update: { value },
    create: { key: ANNOUNCEMENT_KEY, value },
  });
  return parseAnnouncement(row.value);
}
