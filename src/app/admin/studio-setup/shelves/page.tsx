import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ShelvesClient } from "./_components/ShelvesClient";

export default async function ShelvesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "STAFF") {
    return (
      <main className="p-8">
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to view shelf assignments.
        </p>
      </main>
    );
  }

  return <ShelvesClient />;
}
