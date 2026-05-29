"use client";

import { useState } from "react";
import { Star } from "./Star";

type AvisStarsInputProps = {
  value: number;
  onChange: (n: number) => void;
  size?: number;
};

export function AvisStarsInput({ value, onChange, size = 28 }: AvisStarsInputProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value;

  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Note de 1 à 5 étoiles">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          className="rounded-full p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F4A623]/50"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered(n)}
          onBlur={() => setHovered(null)}
        >
          <Star filled={n <= active} size={size} />
        </button>
      ))}
    </div>
  );
}
