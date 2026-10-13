import { auth } from "@/auth";
import { SiteNav } from "@/components/site/SiteNav";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user
    ? { name: session.user.name, role: session.user.role }
    : null;

  return (
    <div className="site-text">
      <SiteNav user={user} />
      <main>{children}</main>
    </div>
  );
}
