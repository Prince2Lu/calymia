"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { captureUtmFromUrl } from "@/lib/analytics/utm";

export function UtmCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    captureUtmFromUrl(new URLSearchParams(searchParams.toString()));
  }, [searchParams]);

  return null;
}
