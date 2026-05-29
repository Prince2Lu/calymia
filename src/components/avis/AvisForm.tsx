"use client";

import { useState } from "react";
import Image from "next/image";
import { AvisStarsInput } from "./AvisStarsInput";

const BRAND = "#2D6A4F";
const MAX_COMMENT = 500;

type AvisFormProps = {
  token: string;
  sophrologue: {
    prenom: string;
    nom: string;
    photo_url: string | null;
  };
};

function initials(prenom: string, nom: string): string {
  const a = prenom.trim().charAt(0);
  const b = nom.trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

export function AvisForm({ token, sophrologue }: AvisFormProps) {
  const [note, setNote] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fullName = [sophrologue.prenom, sophrologue.nom].filter(Boolean).join(" ").trim();

  async function handleSubmit() {
    if (note < 1 || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/avis/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          note,
          commentaire: commentaire.trim() || undefined,
        }),
      });

      const payload: { success?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));

      if (!res.ok || !payload.success) {
        setError(payload.error ?? "Une erreur est survenue. Veuillez réessayer.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Une erreur réseau est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-white"
          style={{ background: BRAND }}
        >
          ✓
        </span>
        <p className="text-lg font-semibold" style={{ color: BRAND }}>
          Merci pour votre avis !
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      {sophrologue.photo_url ? (
        <Image
          src={sophrologue.photo_url}
          alt={fullName}
          width={72}
          height={72}
          className="h-18 w-18 rounded-full object-cover"
          style={{ height: 72, width: 72 }}
        />
      ) : (
        <span
          className="flex h-18 w-18 items-center justify-center rounded-full text-xl font-semibold text-white"
          style={{ background: BRAND, height: 72, width: 72 }}
        >
          {initials(sophrologue.prenom, sophrologue.nom)}
        </span>
      )}

      <h1 className="text-center text-xl font-semibold text-slate-800">
        Votre avis sur {fullName}
      </h1>

      <AvisStarsInput value={note} onChange={setNote} />

      <div className="w-full">
        <textarea
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value.slice(0, MAX_COMMENT))}
          placeholder="Partagez votre expérience (optionnel)"
          rows={4}
          maxLength={MAX_COMMENT}
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/20"
        />
        <p className="mt-1 text-right text-xs text-slate-400">
          {commentaire.length}/{MAX_COMMENT}
        </p>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={note < 1 || loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: BRAND }}
      >
        {loading && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            aria-hidden="true"
          />
        )}
        {loading ? "Envoi…" : "Envoyer mon avis"}
      </button>

      {error && (
        <p className="w-full text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
