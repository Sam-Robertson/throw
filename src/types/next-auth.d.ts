import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      // Locations this user may see. ADMIN: [] (unrestricted — see
      // src/lib/locationScope.ts). STAFF: their StaffRoleAssignment locations,
      // [] meaning none. Captured at sign-in.
      locationIds: string[];
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    locationIds?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    locationIds?: string[];
  }
}
