"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AvisStars } from "./AvisStars";

export type AvisStatut = "en_attente" | "approuve" | "rejete";

export type AvisAvecPatient = {
  id: string;
  sophrologue_id: string;
  patient_id: string | null;
  seance_id: string;
  note: number | null;
  commentaire: string | null;
  statut: AvisStatut;
  token_utilise: boolean;
  token_expire_at: string;
  email_envoye: boolean;
  created_at: string;
  updated_at: string;
  patient_prenom: string | null;
  patient_nom: string | null;
};

type TabKey = AvisStatut;

const TABS: { key: TabKey; label: string }[] = [
  { key: "en_attente", label: "En attente" },
  { key: "approuve", label: "Approuvés" },
  { key: "rejete", label: "Rejetés" },
];

const BRAND = "#2D6A4F";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function patientName(avis: AvisAvecPatient): string {
  const name = [avis.patient_prenom, avis.patient_nom].filter(Boolean).join(" ").trim();
  return name || "Patient anonyme";
}

export function AvisDashboard({ avis }: { avis: AvisAvecPatient[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("en_attente");
  const [items, setItems] = useState<AvisAvecPatient[]>(avis);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(avis);
  }, [avis]);

  const pendingCount = useMemo(
    () => items.filter((a) => a.statut === "en_attente").length,
    [items],
  );

  const visible = useMemo(
    () => items.filter((a) => a.statut === activeTab),
    [items, activeTab],
  );

  async function moderer(avisId: string, action: "approuver" | "rejeter") {
    setError(null);
    setPendingId(avisId);

    const previous = items;
    setItems((prev) => prev.filter((a) => a.id !== avisId));

    try {
      const res = await fetch("/api/avis/moderer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ avis_id: avisId, action }),
      });

      const payload: { success?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));

      if (!res.ok || !payload.success) {
        setItems(previous);
        setError(payload.error ?? "Action impossible. Veuillez réessayer.");
        return;
      }

      router.refresh();
    } catch {
      setItems(previous);
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        <div>
          <h1 className="text-3xl font-semibold text-[#1E3A5F]">Avis clients</h1>
          <p className="mt-1 text-sm text-slate-500">
            Modérez les avis reçus avant leur publication sur votre page publique.
          </p>
        </div>

        <div className="flex gap-2 border-b border-slate-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative -mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-[#2D6A4F] text-[#2D6A4F]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
              {tab.key === "en_attente" && pendingCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}

        {items.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
            Vous n&apos;avez pas encore reçu d&apos;avis.
          </p>
        ) : visible.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
            Aucun avis dans cette catégorie.
          </p>
        ) : (
          <ul className="space-y-4">
            {visible.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {item.note !== null && (
                        <AvisStars mode="display" value={item.note} />
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      {patientName(item)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDate(item.created_at)}
                  </span>
                </div>

                {item.commentaire && (
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                    {item.commentaire}
                  </p>
                )}

                {activeTab === "en_attente" && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      disabled={pendingId === item.id}
                      onClick={() => void moderer(item.id, "approuver")}
                      className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: BRAND }}
                    >
                      Approuver
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === item.id}
                      onClick={() => void moderer(item.id, "rejeter")}
                      className="inline-flex items-center rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Rejeter
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
