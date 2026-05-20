import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SignOutButton } from "./_components/SignOutButton";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <main className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome, {session.user.name ?? session.user.email}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Role: {session.user.role}
          </p>
        </div>
        <SignOutButton />
      </div>
    </main>
  );
}
