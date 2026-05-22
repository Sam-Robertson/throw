"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type DateRange = { from: string; to: string };

function toDateStr(d: Date) {
  // local date string yyyy-MM-dd
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function defaultRange(): DateRange {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toDateStr(from), to: toDateStr(to) };
}

const PRESETS: { label: string; getRange: () => DateRange }[] = [
  {
    label: "This Month",
    getRange: defaultRange,
  },
  {
    label: "Last Month",
    getRange: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toDateStr(from), to: toDateStr(to) };
    },
  },
  {
    label: "Last 30 Days",
    getRange: () => {
      const to = new Date();
      const from = new Date(Date.now() - 29 * 86400000);
      return { from: toDateStr(from), to: toDateStr(to) };
    },
  },
  {
    label: "Last 90 Days",
    getRange: () => {
      const to = new Date();
      const from = new Date(Date.now() - 89 * 86400000);
      return { from: toDateStr(from), to: toDateStr(to) };
    },
  },
  {
    label: "This Year",
    getRange: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(now.getFullYear(), 11, 31);
      return { from: toDateStr(from), to: toDateStr(to) };
    },
  },
];

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: Props) {
  const [activePreset, setActivePreset] = useState<string | null>("This Month");

  function handlePreset(preset: (typeof PRESETS)[number]) {
    setActivePreset(preset.label);
    onChange(preset.getRange());
  }

  function handleFrom(e: React.ChangeEvent<HTMLInputElement>) {
    setActivePreset(null);
    onChange({ ...value, from: e.target.value });
  }

  function handleTo(e: React.ChangeEvent<HTMLInputElement>) {
    setActivePreset(null);
    onChange({ ...value, to: e.target.value });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            size="sm"
            variant={activePreset === p.label ? "default" : "outline"}
            onClick={() => handlePreset(p)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={value.from}
            onChange={handleFrom}
            className="h-8 w-36 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={value.to}
            onChange={handleTo}
            className="h-8 w-36 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
