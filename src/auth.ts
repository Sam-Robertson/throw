import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user?.hashedPassword) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword,
        );
        if (!valid) return null;

        // ADMIN is unrestricted and CUSTOMER never uses admin scoping, so only
        // STAFF need their assigned locations looked up.
        const locationIds =
          user.role === "STAFF"
            ? (
                await prisma.staffRoleAssignment.findMany({
                  where: { userId: user.id },
                  select: { locationId: true },
                })
              ).map((a) => a.locationId)
            : [];

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          locationIds,
        };
      },
    }),
  ],
});
