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
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r">
        <div className="border-b px-4 py-3">
          <span className="font-semibold">Throw</span>
          <p className="text-xs text-muted-foreground">Studio Admin</p>
        </div>
        <AdminNav />
        <div className="border-t px-4 py-3">
          <p className="truncate text-sm font-medium">
            {session.user.name ?? session.user.email}
          </p>
          <p className="text-xs text-muted-foreground">{session.user.role}</p>
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-auto">{children}</div>
    </div>
  );
}
