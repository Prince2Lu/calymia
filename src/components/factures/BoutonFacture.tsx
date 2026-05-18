"use client";

import { Download } from "lucide-react";
import { useFacture } from "@/hooks/useFacture";

type BoutonFactureProps = {
  seanceId: string;
  /** URL déjà chargée via jointure `paiements` (évite une requête supplémentaire). */
  factureUrl?: string | null;
};

export function BoutonFacture({ seanceId, factureUrl: factureUrlProp }: BoutonFactureProps) {
  const hasProp =
    typeof factureUrlProp === "string" && factureUrlProp.length > 0;
  const { factureUrl: factureUrlFetched, loading } = useFacture(seanceId, {
    skip: hasProp,
  });

  const factureUrl = hasProp ? factureUrlProp : factureUrlFetched;
  const loadingState = hasProp ? false : loading;

  if (loadingState || !factureUrl) {
    return null;
  }

  return (
    <a
      href={factureUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      <Download className="h-3.5 w-3.5 shrink-0" />
      Télécharger le reçu
    </a>
  );
}
