import { auth } from "@/auth";
import { PublicNav } from "@/components/shared/PublicNav";

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
    <>
      <PublicNav user={user} />
      <main>{children}</main>
    </>
  );
}
