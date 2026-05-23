"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  waiverVersionId: string;
  callbackUrl: string;
  userName: string;
  content: string;
}

export function WaiverSignatureForm({
  waiverVersionId,
  callbackUrl,
  userName,
  content,
}: Props) {
  const router = useRouter();
  const sigCanvas = useRef<SignatureCanvas>(null);

  const [agreed, setAgreed] = useState(false);
  const [typedName, setTypedName] = useState(userName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sigError, setSigError] = useState(false);
  const [nameError, setNameError] = useState(false);

  function handleClear() {
    sigCanvas.current?.clear();
    setSigError(false);
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
      const signatureData = sigCanvas.current!
        .getTrimmedCanvas()
        .toDataURL("image/png");

      const res = await fetch("/api/waivers/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waiverVersionId,
          typedName: typedName.trim(),
          signatureImageData: signatureData,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to sign waiver");
        return;
      }

      router.push(callbackUrl || "/schedule");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    agreed &&
    !submitting &&
    !(sigCanvas.current?.isEmpty() ?? true) &&
    typedName.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Waiver text */}
      <div className="max-h-96 overflow-y-auto rounded-lg border bg-muted/30 p-6">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {content}
        </pre>
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
            penColor="#000000"
            velocityFilterWeight={0.7}
            canvasProps={{
              className: "w-full rounded-md border",
              style: { height: 200, background: "#ffffff" },
            }}
            onEnd={() => setSigError(false)}
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
