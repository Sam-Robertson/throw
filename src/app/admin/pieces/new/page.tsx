import { Suspense } from "react";
import { DeskIntakeClient } from "./_components/DeskIntakeClient";

// "Log pieces at the desk". Auth and the ADMIN/STAFF gate come from
// src/middleware.ts and admin/layout.tsx; POST /api/admin/pieces enforces the
// studio scope. Suspense is for useSearchParams (?customerId= from the POS).
export default function AdminNewPiecePage() {
  return (
    <Suspense>
      <DeskIntakeClient />
    </Suspense>
  );
}
