import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { getAnnouncementBar } from "@/lib/siteSettings";
import { SiteFooter } from "@/components/site/SiteFooter";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, announcement] = await Promise.all([auth(), getAnnouncementBar()]);
  if (!session) redirect("/login?callbackUrl=/staff");
  if (session.user.role === "CUSTOMER") redirect("/dashboard");

  const user = { name: session.user.name, role: session.user.role };

  return (
    <div className="site-text">
      <div className="print:hidden">
        <SiteNav user={user} announcement={announcement} />
      </div>
      <main>{children}</main>
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </div>
  );
}
