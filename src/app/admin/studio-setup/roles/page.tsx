import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { RolesClient } from "./_components/RolesClient";

export default async function RolesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <RolesClient isAdmin={session.user.role === "ADMIN"} />;
}
