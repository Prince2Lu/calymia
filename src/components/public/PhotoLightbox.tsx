"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function PhotoLightbox({
  src,
  onClose,
  sophrologueName,
}: {
  src: string | null;
  onClose: () => void;
  sophrologueName: string;
}) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Agrandir la photo"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-[101] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Fermer"
      >
        <X className="h-6 w-6" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Photo du cabinet de ${sophrologueName} en grand format`}
        className="max-h-[80vh] max-w-[80vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/** Grille cliquable + lightbox (client — requis pour l’état d’ouverture). */
export function CabinetPhotoGallery({
  urls,
  sophrologueName,
}: {
  urls: string[];
  sophrologueName: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {urls.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => setOpen(url)}
            className="relative h-24 w-full overflow-hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-[#426F59] focus:ring-offset-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Photo du cabinet de ${sophrologueName}`}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
      <PhotoLightbox
        src={open}
        onClose={() => setOpen(null)}
        sophrologueName={sophrologueName}
      />
    </>
  );
}
