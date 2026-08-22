"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  status: string;
  currentPeriodEndFormatted: string;
  inCommitment: boolean;
  commitmentEndsAtFormatted: string | null;
}

export function MembershipActions({
  status,
  currentPeriodEndFormatted,
  inCommitment,
  commitmentEndsAtFormatted,
}: Props) {
  const router = useRouter();
  const [pauseOpen, setPauseOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handlePause() {
    setLoading(true);
    try {
      const res = await fetch("/api/memberships/pause", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to pause membership");
        return;
      }
      setPauseOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    setLoading(true);
    try {
      const res = await fetch("/api/memberships/cancel", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to cancel membership");
        return;
      }
      setCancelOpen(false);
      router.push("/membership");
    } finally {
      setLoading(false);
    }
  }

  async function handleResume() {
    setLoading(true);
    try {
      const res = await fetch("/api/memberships/resume", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to resume membership");
        return;
      }
      setResumeOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex gap-3">
        {status === "ACTIVE" && (
          <Button variant="outline" onClick={() => setPauseOpen(true)}>
            Pause Membership
          </Button>
        )}
        {status === "PAUSED" && (
          <Button variant="default" onClick={() => setResumeOpen(true)}>
            Resume Membership
          </Button>
        )}
        {(status === "ACTIVE" || status === "PAUSED") && (
          <Button
            variant="destructive"
            onClick={() => setCancelOpen(true)}
            disabled={inCommitment}
            title={
              inCommitment && commitmentEndsAtFormatted
                ? `Commitment through ${commitmentEndsAtFormatted}`
                : undefined
            }
          >
            Cancel Membership
          </Button>
        )}
      </div>
      {inCommitment && commitmentEndsAtFormatted && (status === "ACTIVE" || status === "PAUSED") && (
        <p className="mt-2 text-sm text-muted-foreground">
          Commitment through {commitmentEndsAtFormatted}. Cancellation is unavailable until then.
        </p>
      )}

      {/* Pause dialog */}
      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause your membership?</DialogTitle>
            <DialogDescription>
              Your membership will stay active until{" "}
              <span className="font-medium text-foreground">
                {currentPeriodEndFormatted}
              </span>
              . After that it will be paused for 30 days, then expire. You can
              resume anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseOpen(false)} disabled={loading}>
              Keep membership
            </Button>
            <Button onClick={handlePause} disabled={loading}>
              {loading ? "Pausing…" : "Pause membership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resume dialog */}
      <Dialog open={resumeOpen} onOpenChange={setResumeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resume your membership?</DialogTitle>
            <DialogDescription>
              A new billing cycle will start immediately on your current plan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResumeOpen(false)} disabled={loading}>
              Not now
            </Button>
            <Button onClick={handleResume} disabled={loading}>
              {loading ? "Resuming…" : "Resume membership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel your membership?</DialogTitle>
            <DialogDescription>
              Are you sure? You will lose access immediately and will not be
              refunded for the remaining period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={loading}>
              Keep membership
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={loading}>
              {loading ? "Cancelling…" : "Yes, cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
