"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Loader2,
  CheckCircle2,
  Save,
  X,
  StickyNote,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatParisTime } from "@/lib/timezone";
import { planAllowsSeanceNotes } from "@/lib/email-templates/placeholders";
import { seanceNoteHtmlIsNonEmpty } from "@/lib/seance-notes";
import { BoutonFacture } from "@/components/factures/BoutonFacture";
import NoteSeance from "@/components/dashboard/NoteSeance";
import { PlanGuard } from "@/components/plan/PlanGuard";
import { normalizePlan } from "@/hooks/usePlan";

// ─── Types ────────────────────────────────────────────────────────────────────

type Patient = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  notes: string | null;
  created_at: string;
};

type Seance = {
  id: string;
  debut_at: string;
  statut: string;
  type_seance: { nom: string | null } | null;
  paiement:
    | { montant_total: number | null; facture_url: string | null }
    | { montant_total: number | null; facture_url: string | null }[]
    | null;
};

function resolvePaiement(
  paiement: Seance["paiement"],
): { montant_total: number | null; facture_url: string | null } | null {
  if (!paiement) return null;
  const row = Array.isArray(paiement) ? paiement[0] : paiement;
  return row ?? null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return formatParisTime(iso, "dateShort");
}

function formatTime(iso: string) {
  return formatParisTime(iso, "HH:mm");
}

function statutColor(statut: string) {
  switch (statut) {
    case "confirmee":
      return "bg-[#27AE60]/10 text-[#27AE60] ring-[#27AE60]/20";
    case "en_attente":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "annulee":
      return "bg-red-50 text-red-600 ring-red-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

function statutLabel(statut: string) {
  switch (statut) {
    case "confirmee":
      return "Confirmée";
    case "en_attente":
      return "En attente";
    case "annulee":
      return "Annulée";
    default:
      return statut;
  }
}

function initials(prenom: string | null, nom: string | null) {
  return `${prenom?.[0]?.toUpperCase() ?? ""}${nom?.[0]?.toUpperCase() ?? ""}` || "?";
}

// ─── Composant Notes avec auto-save ───────────────────────────────────────────

function NotesSection({
  patientId,
  initialNotes,
}: {
  patientId: string;
  initialNotes: string | null;
}) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (value: string) => {
      setSaving(true);
      setSaved(false);
      try {
        await fetch("/api/patients/update-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patient_id: patientId, notes: value }),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } finally {
        setSaving(false);
      }
    },
    [patientId],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(val), 1200);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Notes cliniques
        </h2>
        <span className="flex items-center gap-1 text-xs text-slate-400">
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          {saving && "Enregistrement…"}
          {!saving && saved && (
            <>
              <CheckCircle2 className="h-3 w-3 text-[#27AE60]" />
              <span className="text-[#27AE60]">Enregistré</span>
            </>
          )}
          {!saving && !saved && (
            <>
              <Save className="h-3 w-3" />
              Auto-save
            </>
          )}
        </span>
      </div>
      <textarea
        value={notes}
        onChange={handleChange}
        rows={6}
        placeholder="Ajoutez ici vos notes cliniques, observations, objectifs thérapeutiques…"
        className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
      />
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type SophrologueProfile = { id: string; plan: string | null };

export default function FichePatientPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [seances, setSeances] = useState<Seance[]>([]);
  const [loading, setLoading] = useState(true);
  const [sophrologue, setSophrologue] = useState<SophrologueProfile | null>(
    null,
  );
  const [seanceHasNote, setSeanceHasNote] = useState<Record<string, boolean>>(
    {},
  );
  const [notesPanelSeanceId, setNotesPanelSeanceId] = useState<string | null>(
    null,
  );

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Patient
      const { data: patientData } = await supabase
        .from("patients")
        .select("id, prenom, nom, email, telephone, notes, created_at")
        .eq("id", params.id)
        .maybeSingle<Patient>();

      if (cancelled) return;
      if (!patientData) {
        router.replace("/clients");
        return;
      }
      setPatient(patientData);

      // Séances avec type + paiement
      const { data: seancesData } = await supabase
        .from("seances")
        .select(
          "id, debut_at, statut, type_seance:types_seances(nom), paiement:paiements(montant_total, facture_url)",
        )
        .eq("patient_id", params.id)
        .order("debut_at", { ascending: false })
        .returns<Seance[]>();

      if (!cancelled) {
        setSeances(seancesData ?? []);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && !cancelled) {
        const { data: soph } = await supabase
          .from("sophrologues")
          .select("id, plan")
          .eq("user_id", user.id)
          .maybeSingle<SophrologueProfile>();

        if (!cancelled && soph) {
          setSophrologue(soph);
          if (planAllowsSeanceNotes(soph.plan)) {
            const { data: noteRows } = await supabase
              .from("seance_notes")
              .select("seance_id, contenu_html")
              .eq("patient_id", params.id)
              .eq("sophrologue_id", soph.id);

            const map: Record<string, boolean> = {};
            for (const row of noteRows ?? []) {
              if (seanceNoteHtmlIsNonEmpty(row.contenu_html)) {
                map[row.seance_id] = true;
              }
            }
            if (!cancelled) setSeanceHasNote(map);
          }
        }
      }

      if (!cancelled) setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [params.id, supabase, router]);

  const refreshSeanceNotesMap = useCallback(async () => {
    if (!patient || !sophrologue || !planAllowsSeanceNotes(sophrologue.plan)) {
      return;
    }
    const { data: noteRows } = await supabase
      .from("seance_notes")
      .select("seance_id, contenu_html")
      .eq("patient_id", patient.id)
      .eq("sophrologue_id", sophrologue.id);
    const map: Record<string, boolean> = {};
    for (const row of noteRows ?? []) {
      if (seanceNoteHtmlIsNonEmpty(row.contenu_html)) {
        map[row.seance_id] = true;
      }
    }
    setSeanceHasNote(map);
  }, [patient, sophrologue, supabase]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#2E75B6]" />
      </main>
    );
  }

  if (!patient) return null;

  const nomComplet =
    `${patient.prenom ?? ""} ${patient.nom ?? ""}`.trim() || "Client inconnu";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        {/* ── Retour ───────────────────────────────────────────────────── */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#1E3A5F]"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux clients
        </button>

        {/* ── Hero patient ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1E3A5F]/10 text-xl font-bold text-[#1E3A5F]">
            {initials(patient.prenom, patient.nom)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">
              {nomComplet}
            </h1>
            <p className="text-sm text-slate-500">
              Client depuis le {formatDate(patient.created_at)}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── Colonne gauche : infos + notes ───────────────────────── */}
          <div className="space-y-6 lg:col-span-1">
            {/* Informations personnelles */}
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Informations personnelles
              </h2>
              <InfoRow
                icon={<Mail className="h-4 w-4 text-[#2E75B6]" />}
                label="Email"
                value={patient.email ?? "—"}
              />
              <InfoRow
                icon={<Phone className="h-4 w-4 text-[#2E75B6]" />}
                label="Téléphone"
                value={patient.telephone ?? "—"}
              />
              <InfoRow
                icon={<Calendar className="h-4 w-4 text-[#2E75B6]" />}
                label="Séances"
                value={`${seances.filter((s) => s.statut === "confirmee").length} confirmée(s)`}
              />
            </section>
          </div>

          {/* ── Colonne droite : notes + historique ──────────────────── */}
          <div className="space-y-6 lg:col-span-2">
            {/* Notes */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <NotesSection
                patientId={patient.id}
                initialNotes={patient.notes}
              />
            </section>

            {/* Historique des séances */}
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Historique des séances
              </h2>

              {seances.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Aucune séance enregistrée pour ce client.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {seances.map((s) => {
                    const paiementRow = resolvePaiement(s.paiement);
                    const montant = paiementRow?.montant_total ?? null;
                    const factureUrl = paiementRow?.facture_url ?? null;
                    const typeNom = Array.isArray(s.type_seance)
                      ? (s.type_seance[0]?.nom ?? "Séance")
                      : (s.type_seance?.nom ?? "Séance");
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {formatDate(s.debut_at)} — {formatTime(s.debut_at)}
                          </p>
                          <p className="text-xs text-slate-500">{typeNom}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                          {planAllowsSeanceNotes(sophrologue?.plan) &&
                            seanceHasNote[s.id] && (
                              <span className="inline-flex items-center rounded-full bg-[#426F59]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#426F59] ring-1 ring-[#426F59]/25">
                                Note
                              </span>
                            )}
                          {montant !== null && (
                            <span className="text-sm font-medium text-slate-700">
                              {montant.toFixed(2)} €
                            </span>
                          )}
                          {montant !== null && (
                            <BoutonFacture seanceId={s.id} factureUrl={factureUrl} />
                          )}
                          {sophrologue && (
                            <button
                              type="button"
                              onClick={() => setNotesPanelSeanceId(s.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1 text-xs font-medium text-[#426F59] hover:bg-[#F0F7F4]"
                            >
                              <StickyNote className="h-3.5 w-3.5" />
                              Notes
                            </button>
                          )}
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statutColor(
                              s.statut,
                            )}`}
                          >
                            {statutLabel(s.statut)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {notesPanelSeanceId && patient && sophrologue && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            aria-hidden
            onClick={() => setNotesPanelSeanceId(null)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#d1d5db] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#d1d5db] px-4 py-3">
              <h2 className="text-sm font-semibold text-[#1E3A5F]">
                Notes de séance
              </h2>
              <button
                type="button"
                onClick={() => setNotesPanelSeanceId(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <PlanGuard
                requiredPlan="professionnel"
                currentPlan={normalizePlan(sophrologue.plan)}
                featureName="Notes de séance"
              >
                <NoteSeance
                  seanceId={notesPanelSeanceId}
                  patientId={patient.id}
                  sophrologueId={sophrologue.id}
                  onSaved={() => void refreshSeanceNotesMap()}
                />
              </PlanGuard>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}

// ─── InfoRow helper ───────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}
