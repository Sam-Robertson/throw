import { auth } from '@/auth';
import { SiteNav } from '@/components/site/SiteNav';
import { getAnnouncementBar } from '@/lib/siteSettings';
import { SiteFooter } from '@/components/site/SiteFooter';

/**
 * The signed-in customer area (dashboard, booking, my classes, membership,
 * account, buying clay and firing) sits under the same header and footer as
 * the marketing site, as the "Membership Portal" design draws it.
 */
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const [session, announcement] = await Promise.all([auth(), getAnnouncementBar()]);
  const user = session?.user ? { name: session.user.name, role: session.user.role } : null;

  return (
    <div className="site-text">
      <SiteNav user={user} announcement={announcement} />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
