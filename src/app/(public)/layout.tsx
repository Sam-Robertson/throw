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
    <>
      <SiteNav user={user} />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
