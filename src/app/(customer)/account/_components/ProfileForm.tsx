"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UserProfile {
  name: string | null;
  email: string;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

export function ProfileForm({ user }: { user: UserProfile }) {
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [ecName, setEcName] = useState(user.emergencyContactName ?? "");
  const [ecPhone, setEcPhone] = useState(user.emergencyContactPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        emergencyContactName: ecName,
        emergencyContactPhone: ecPhone,
      }),
    });

    if (res.ok) {
      setSuccess(true);
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? "Something went wrong");
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Name *</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-email">Email</Label>
        <Input
          id="profile-email"
          value={user.email}
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          Email cannot be changed.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-phone">Phone number</Label>
        <Input
          id="profile-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ec-name">Emergency contact name</Label>
          <Input
            id="ec-name"
            value={ecName}
            onChange={(e) => setEcName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ec-phone">Emergency contact phone</Label>
          <Input
            id="ec-phone"
            type="tel"
            value={ecPhone}
            onChange={(e) => setEcPhone(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-green-600">Changes saved successfully.</p>
      )}

      <Button type="submit" disabled={saving || !name.trim()}>
        {saving ? "Saving…" : "Save Changes"}
      </Button>
    </form>
  );
}
