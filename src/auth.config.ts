import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

export const authConfig: NextAuthConfig = {
  // Lets NextAuth infer its own host from the request when AUTH_URL isn't
  // set, rather than erroring — recommended for serverless/Vercel deploys.
  // Note this does NOT override an explicit AUTH_URL if one is set (Auth.js
  // always honors that verbatim) — the actual prod redirect bug was a
  // stale AUTH_URL="http://localhost:3000", fixed by correcting that env
  // var in Vercel, not by this setting.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present on sign-in, so locationIds refresh each time the
      // user signs in. This file runs in the Edge middleware too, so the
      // StaffRoleAssignment lookup happens in authorize() (src/auth.ts), not here.
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.locationIds = user.locationIds ?? [];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        // Tokens issued before this field existed have no locationIds; STAFF
        // on such a token see nothing until they sign in again.
        session.user.locationIds = (token.locationIds as string[] | undefined) ?? [];
      }
      return session;
    },
  },
};
