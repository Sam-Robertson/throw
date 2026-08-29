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
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
};
