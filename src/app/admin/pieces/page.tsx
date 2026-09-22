import { Suspense } from "react";
import { AdminPiecesClient } from "./_components/AdminPiecesClient";

// Auth and the ADMIN/STAFF gate come from src/middleware.ts and admin/layout.tsx;
// location scoping is enforced by /api/admin/pieces. Suspense is for
// useSearchParams (the ?userId= filter from a customer's profile).
export default function AdminPiecesPage() {
  return (
    <Suspense>
      <AdminPiecesClient />
    </Suspense>
  );
}
