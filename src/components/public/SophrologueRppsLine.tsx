"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

const RPPS_TOOLTIP =
  "Le numéro RPPS (Répertoire Partagé des Professionnels de Santé) est un identifiant unique attribué à chaque professionnel de santé en France. Il garantit que ce praticien est bien enregistré auprès des autorités sanitaires.";

type SophrologueRppsLineProps = {
  numero: string;
  label?: string;
  tooltip?: string;
  tooltipAriaLabel?: string;
};

export function SophrologueRppsLine({
  numero,
  label = "N° RPPS",
  tooltip = RPPS_TOOLTIP,
  tooltipAriaLabel = "Qu'est-ce que le numéro RPPS ?",
}: SophrologueRppsLineProps) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;
  const [placeAbove, setPlaceAbove] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipId = useId();

  const updatePlacement = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    setPlaceAbove(spaceAbove >= spaceBelow || spaceAbove > 140);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, updatePlacement]);

  return (
    <div ref={wrapRef} className="relative text-sm text-slate-700">
      <p className="inline-flex flex-wrap items-center gap-1.5">
        <span>
          <span className="font-medium text-slate-800">{label} :</span> {numero}
        </span>
        <button
          type="button"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#426F59] transition-colors hover:bg-[#EAF3DE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#426F59]/40"
          aria-label={tooltipAriaLabel}
          aria-expanded={open}
          aria-controls={tipId}
          onClick={() => {
            setPinned((v) => {
              const next = !v;
              if (next) requestAnimationFrame(updatePlacement);
              return next;
            });
          }}
          onMouseEnter={() => {
            if (!window.matchMedia("(hover: hover)").matches) return;
            updatePlacement();
            setHovered(true);
          }}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => {
            updatePlacement();
            setHovered(true);
          }}
          onBlur={(e) => {
            if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) {
              setHovered(false);
              setPinned(false);
            }
          }}
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>
      </p>

      {open && (
        <div
          id={tipId}
          role="tooltip"
          className={`absolute z-50 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs leading-relaxed text-slate-600 shadow-lg ${
            placeAbove ? "bottom-full mb-2 left-0" : "top-full mt-2 left-0"
          }`}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
