"use client";

import { useState } from "react";

const MAX = 300;

export function SophrologueBioExpandable({ bio }: { bio: string }) {
  const [open, setOpen] = useState(false);
  const trimmed = bio.trim();
  const long = trimmed.length > MAX;
  const display = !open && long ? `${trimmed.slice(0, MAX).trimEnd()}…` : trimmed;

  return (
    <div className="space-y-2">
      <p className="text-[15px] leading-relaxed text-slate-700 whitespace-pre-line">
        {display}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-sm font-medium text-[#426F59] underline-offset-2 hover:underline"
        >
          {open ? "Réduire" : "Lire plus"}
        </button>
      )}
    </div>
  );
}
