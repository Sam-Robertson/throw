"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/site/Button";
import { OptionCardGroup } from "@/components/site/OptionCard";
import { CANCEL_REASONS } from "@/lib/membershipLifecycle";

export function CancelReasonForm() {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [going, setGoing] = useState(false);

  return (
    <>
      <OptionCardGroup
        name="reason"
        options={CANCEL_REASONS.map((r) => ({ id: r.id, label: r.label }))}
        value={reason}
        onChange={setReason}
        className="mt-8"
      />
      <div className="sticky bottom-0 mt-auto bg-white pt-8 pb-4">
        <Button
          block
          disabled={!reason || going}
          onClick={() => {
            setGoing(true);
            router.push(`/membership/cancel/confirm?reason=${encodeURIComponent(reason)}`);
          }}
        >
          Continue to cancel
        </Button>
      </div>
    </>
  );
}
