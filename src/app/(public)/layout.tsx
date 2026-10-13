import { auth } from '@/auth';
import { SiteNav } from '@/components/site/SiteNav';
import { SiteFooter } from '@/components/site/SiteFooter';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user
    ? { name: session.user.name, role: session.user.role }
    : null;

  return (
    // .site-text restores the OS default font smoothing for the marketing
    // site (globals.css) so Satoshi renders at the weight the designs show.
    <div className="site-text">
      <SiteNav user={user} />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
