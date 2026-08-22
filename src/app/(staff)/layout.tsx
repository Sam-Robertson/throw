import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PublicNav } from "@/components/shared/PublicNav";
import { PublicFooter } from "@/components/shared/PublicFooter";

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
    <>
      <div className="print:hidden">
        <PublicNav user={user} />
      </div>
      <main>{children}</main>
      <div className="print:hidden">
        <PublicFooter />
      </div>
    </>
  );
}
