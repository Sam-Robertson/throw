"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "$3", cents: 300 },
  { label: "$5", cents: 500 },
  { label: "$10", cents: 1000 },
  { label: "$20", cents: 2000 },
];

interface Props {
  bookingId: string;
  instructorName: string;
  sessionName: string;
  sessionDate: string;
}

export function TipForm({ bookingId, instructorName, sessionName, sessionDate }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedCents, setSelectedCents] = useState<number | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customDollars, setCustomDollars] = useState("");
  const [error, setError] = useState<string | null>(null);

  function selectPreset(cents: number) {
    setSelectedCents(cents);
    setShowCustom(false);
    setCustomDollars("");
    setError(null);
  }

  function selectOther() {
    setSelectedCents(null);
    setShowCustom(true);
    setError(null);
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    setCustomDollars(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedCents(Math.round(parsed * 100));
    } else {
      setSelectedCents(null);
    }
    setError(null);
  }

  function getDisplayAmount(): string | null {
    if (selectedCents === null) return null;
    return (selectedCents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  }

  function handleSubmit() {
    if (!selectedCents) {
      setError("Please select a tip amount.");
      return;
    }
    if (selectedCents < 100) {
      setError("Minimum tip is $1.00.");
      return;
    }
    if (selectedCents > 10000) {
      setError("Maximum tip is $100.00.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/tips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, amountInCents: selectedCents }),
        });

        const data = (await res.json()) as { checkoutUrl?: string; error?: string };

        if (!res.ok) {
          setError(data.error ?? "Something went wrong. Please try again.");
          return;
        }

        if (data.checkoutUrl) {
          router.push(data.checkoutUrl);
        } else {
          setError("Could not start checkout. Please try again.");
        }
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  const display = getDisplayAmount();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {sessionName} &middot; {sessionDate}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          Leave a tip for {instructorName}
        </h1>
      </div>

      {/* Preset buttons */}
      <div>
        <p className="mb-2 text-sm font-medium">Select an amount</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.cents}
              onClick={() => selectPreset(p.cents)}
              className={cn(
                "rounded-full border px-5 py-2 text-sm font-medium transition-colors",
                selectedCents === p.cents && !showCustom
                  ? "border-foreground bg-foreground text-background"
                  : "hover:border-foreground hover:bg-accent",
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={selectOther}
            className={cn(
              "rounded-full border px-5 py-2 text-sm font-medium transition-colors",
              showCustom
                ? "border-foreground bg-foreground text-background"
                : "hover:border-foreground hover:bg-accent",
            )}
          >
            Other
          </button>
        </div>
      </div>

      {/* Custom amount input */}
      {showCustom && (
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="custom-tip">
            Custom amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="custom-tip"
              type="number"
              min="1"
              max="100"
              step="1"
              placeholder="0.00"
              value={customDollars}
              onChange={handleCustomChange}
              className="pl-7 w-36"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Selected amount display */}
      {display && (
        <div className="rounded-lg bg-muted px-5 py-4 text-center">
          <p className="text-xs text-muted-foreground">Tip amount</p>
          <p className="mt-0.5 text-4xl font-bold tracking-tight">{display}</p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={!selectedCents || isPending}
        className="w-full"
        size="lg"
      >
        {isPending ? "Redirecting to payment…" : `Send Tip${display ? ` · ${display}` : ""}`}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        You&apos;ll be taken to a secure Stripe checkout page.
      </p>
    </div>
  );
}
