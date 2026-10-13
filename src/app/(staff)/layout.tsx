import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/staff");
  if (session.user.role === "CUSTOMER") redirect("/dashboard");

  const user = { name: session.user.name, role: session.user.role };

  return (
    <div className="site-text">
      <div className="print:hidden">
        <SiteNav user={user} />
      </div>
      <main>{children}</main>
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </div>
  );
}
