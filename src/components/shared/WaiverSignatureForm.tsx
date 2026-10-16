"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichText } from "@/components/shared/RichText";

interface Props {
  waiverVersionId: string;
  callbackUrl: string;
  userName: string;
  content: string;
}

/**
 * The drawn signature as a PNG data URL no wider than 600px. A phone draws
 * the canvas at 3x, so an untrimmed export runs to a few thousand pixels
 * wide; this keeps the request small and the stored image sensible.
 */
function shrinkSignature(trimmed: HTMLCanvasElement): string {
  const maxWidth = 600;
  if (trimmed.width <= maxWidth) return trimmed.toDataURL("image/png");
  const scale = maxWidth / trimmed.width;
  const small = document.createElement("canvas");
  small.width = maxWidth;
  small.height = Math.max(1, Math.round(trimmed.height * scale));
  const ctx = small.getContext("2d");
  if (!ctx) return trimmed.toDataURL("image/png");
  ctx.drawImage(trimmed, 0, 0, small.width, small.height);
  return small.toDataURL("image/png");
}

export function WaiverSignatureForm({
  waiverVersionId,
  callbackUrl,
  userName,
  content,
}: Props) {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const [agreed, setAgreed] = useState(false);
  // Drawing on the canvas doesn't re-render React, so whether a signature
  // exists is tracked here (set on every stroke, cleared with Clear). Reading
  // sigCanvas.isEmpty() at render time left the button disabled after the
  // customer signed when their name was already filled in.
  const [hasSignature, setHasSignature] = useState(false);
  const [typedName, setTypedName] = useState(userName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sigError, setSigError] = useState(false);
  const [nameError, setNameError] = useState(false);

  function handleClear() {
    sigCanvas.current?.clear();
    setHasSignature(false);
    setSigError(false);
  }

  function handleStrokeEnd() {
    setHasSignature(!(sigCanvas.current?.isEmpty() ?? true));
    setSigError(false);
  }

  function leave() {
    // A full navigation, not router.push: the page we return to decides
    // server-side whether another waiver is still needed, and must not be
    // served from the client router cache with the old "sign your waiver"
    // banner.
    window.location.assign(callbackUrl || "/dashboard");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) return;

    // Validate
    const isEmpty = sigCanvas.current?.isEmpty() ?? true;
    const noName = !typedName.trim();

    setSigError(isEmpty);
    setNameError(noName);
    if (isEmpty || noName) return;

    setSubmitting(true);
    setError(null);

    try {
      const signatureData = shrinkSignature(sigCanvas.current!.getTrimmedCanvas());

      const body = JSON.stringify({
        waiverVersionId,
        typedName: typedName.trim(),
        signatureImageData: signatureData,
      });
      const send = () =>
        fetch("/api/waivers/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      // A phone that drops the connection for a moment ("Load failed" on
      // iOS) gets one quiet retry before the error shows.
      let res: Response;
      try {
        res = await send();
      } catch {
        await new Promise((r) => setTimeout(r, 1500));
        res = await send();
      }

      if (!res.ok) {
        // Signed already (a double tap, or signed on another device): carry on.
        if (res.status === 409) {
          leave();
          return;
        }
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to sign waiver");
        setSubmitting(false);
        return;
      }

      leave();
    } catch {
      setError("Couldn't reach the server. Check the connection and try again.");
      setSubmitting(false);
    }
  }

  const canSubmit = agreed && !submitting && hasSignature && typedName.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Waiver text */}
      <div className="max-h-96 overflow-y-auto rounded-lg border bg-muted/30 p-6">
        <RichText value={content} className="text-sm leading-relaxed" />
      </div>

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="agree"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
        />
        <label htmlFor="agree" className="cursor-pointer text-sm leading-snug">
          I have read and agree to the terms above
        </label>
      </div>

      {/* 2. Drawn signature */}
      <div className={!agreed ? "pointer-events-none opacity-50" : ""}>
        <Label className="mb-2 block">Draw your signature</Label>
        <div className="w-full">
          <SignatureCanvas
            ref={sigCanvas}
            // iOS Safari fires resize events as the address bar collapses
            // while scrolling; the library's default wipes the drawing on
            // every one, which is how JP lost his signature (2026-10-15).
            clearOnResize={false}
            penColor="#000000"
            velocityFilterWeight={0.7}
            canvasProps={{
              className: "w-full rounded-md border",
              style: { height: 200, background: "#ffffff" },
            }}
            onEnd={handleStrokeEnd}
          />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleClear}
            disabled={!agreed}
          >
            Clear
          </Button>
          <span className="text-xs text-muted-foreground">
            Sign using your mouse or finger
          </span>
        </div>
        {sigError && (
          <p className="mt-1 text-sm text-destructive">
            Please draw your signature above
          </p>
        )}
      </div>

      {/* 3. Typed name */}
      <div className={!agreed ? "pointer-events-none opacity-50" : ""}>
        <Label htmlFor="typedName" className="mb-2 block">
          Type your full name
        </Label>
        <Input
          id="typedName"
          value={typedName}
          onChange={(e) => {
            setTypedName(e.target.value);
            setNameError(false);
          }}
          placeholder="Your full name"
          disabled={!agreed}
        />
        {nameError && (
          <p className="mt-1 text-sm text-destructive">
            Please type your full name
          </p>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">
          By typing your name above you confirm this is your legal signature.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!canSubmit}
      >
        {submitting ? "Signing…" : "Sign Waiver and Continue"}
      </Button>
    </form>
  );
}
