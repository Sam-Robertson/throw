import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminNav } from "./_components/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div>
      <AdminNav />
      <main>{children}</main>
    </div>
  );
}
