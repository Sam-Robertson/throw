import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SuppressionsClient } from "./_components/SuppressionsClient";

export default async function SuppressionsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  return <SuppressionsClient />;
}
