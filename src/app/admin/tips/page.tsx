import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminTipsClient } from "./_components/AdminTipsClient";

export default async function AdminTipsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  return <AdminTipsClient />;
}
