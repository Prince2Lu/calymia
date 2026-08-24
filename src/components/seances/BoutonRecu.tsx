"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";

type BoutonRecuProps = {
  seanceId: string;
  recuUrl: string | null;
};

export function BoutonRecu({ seanceId, recuUrl: recuUrlProp }: BoutonRecuProps) {
  const [recuUrl, setRecuUrl] = useState<string | null>(recuUrlProp);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRecuUrl(recuUrlProp);
    setError(null);
  }, [seanceId, recuUrlProp]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recus/generer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seance_id: seanceId }),
      });
      const data = (await res.json()) as { recu_url?: string; error?: string };
      if (!res.ok || !data.recu_url) {
        setError(data.error ?? "Impossible de générer le reçu");
        return;
      }
      setRecuUrl(data.recu_url);
    } catch {
      setError("Impossible de générer le reçu");
    } finally {
      setLoading(false);
    }
  }

  if (recuUrl) {
    return (
      <a
        href={recuUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        Télécharger le reçu
      </a>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5 shrink-0" />
        )}
        {loading ? "Génération…" : "Générer un reçu"}
      </button>
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
