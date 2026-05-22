import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ProfileForm } from "./_components/ProfileForm";
import { PasswordForm } from "./_components/PasswordForm";
import { DangerZone } from "./_components/DangerZone";

export default async function AccountPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
    },
  });

  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold">Account Settings</h1>
      </div>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Profile</h2>
        <ProfileForm user={user} />
      </section>

      <div className="mb-10 border-t" />

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Change Password</h2>
        <PasswordForm />
      </section>

      <div className="mb-10 border-t" />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-destructive">
          Danger Zone
        </h2>
        <DangerZone />
      </section>
    </main>
  );
}
