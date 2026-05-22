"use client";

import { useEffect } from "react";
import { captureUTM } from "@/lib/utm";

export function UTMCapture() {
  useEffect(() => {
    captureUTM();
  }, []);
  return null;
}
