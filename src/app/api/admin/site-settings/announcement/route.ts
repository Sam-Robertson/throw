import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAnnouncement, saveAnnouncement } from '@/lib/siteSettings';

/** The site's announcement bar. GET reads it, PUT saves it (admins only). */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(await getAnnouncement());
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    enabled?: unknown;
    text?: unknown;
    href?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 120) : '';
  const enabled = body.enabled === true;
  if (enabled && !text) {
    return NextResponse.json({ error: 'Write the banner text, or switch it off.' }, { status: 400 });
  }
  const rawHref = typeof body.href === 'string' ? body.href.trim() : '';
  if (rawHref && !/^(https?:\/\/|\/)/.test(rawHref)) {
    return NextResponse.json(
      { error: 'The link must start with / (a page on this site) or https://.' },
      { status: 400 },
    );
  }

  const saved = await saveAnnouncement({ enabled, text, href: rawHref || null });
  return NextResponse.json(saved);
}
