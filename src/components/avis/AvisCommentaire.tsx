"use client";

import { useState } from "react";

const LIMIT = 300;

export function AvisCommentaire({ texte }: { texte: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = texte.length > LIMIT;

  if (!isLong) {
    return (
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
        {texte}
      </p>
    );
  }

  const shown = expanded ? texte : `${texte.slice(0, LIMIT).trimEnd()}…`;

  return (
    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
      {shown}{" "}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="font-medium text-[#426F59] underline-offset-2 hover:underline"
      >
        {expanded ? "Réduire" : "Lire la suite"}
      </button>
    </p>
  );
}
