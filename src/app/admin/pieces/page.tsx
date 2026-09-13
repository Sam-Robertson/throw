import { AdminPiecesClient } from "./_components/AdminPiecesClient";

// Auth and the ADMIN/STAFF gate come from src/middleware.ts and admin/layout.tsx;
// location scoping is enforced by /api/admin/pieces.
export default function AdminPiecesPage() {
  return <AdminPiecesClient />;
}
