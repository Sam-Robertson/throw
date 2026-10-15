import { auth } from "@/auth";
import { SiteNav } from "@/components/site/SiteNav";
import { getAnnouncementBar } from "@/lib/siteSettings";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, announcement] = await Promise.all([auth(), getAnnouncementBar()]);
  const user = session?.user
    ? { name: session.user.name, role: session.user.role }
    : null;

  return (
    <div className="site-text">
      <SiteNav user={user} announcement={announcement} />
      <main>{children}</main>
    </div>
  );
}
