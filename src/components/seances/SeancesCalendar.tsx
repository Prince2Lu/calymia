"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Mail,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Copy,
  Video,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoutonFacture } from "@/components/factures/BoutonFacture";
import NoteSeance from "@/components/dashboard/NoteSeance";
import { PlanGuard } from "@/components/plan/PlanGuard";
import { normalizePlan } from "@/hooks/usePlan";
import {
  addParisCalendarDays,
  formatParisTime,
  getParisHour,
  getParisYMD,
  isSameParisCalendarDay,
  startOfWeekParisMonday,
} from "@/lib/timezone";
import { type Seance, SEANCES_SELECT } from "@/components/seances/types";

function resolvePaiement(
  paiement: Seance["paiement"],
): { montant_total: number | null; facture_url: string | null } | null {
  if (!paiement) return null;
  const row = Array.isArray(paiement) ? paiement[0] : paiement;
  return row ?? null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8h → 19h
const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, n: number): Date {
  return addParisCalendarDays(date, n);
}

function isSameDay(a: Date, b: Date) {
  return isSameParisCalendarDay(a, b);
}

function formatWeekRange(monday: Date): string {
  const sunday = addParisCalendarDays(monday, 6);
  const A = getParisYMD(monday);
  const B = getParisYMD(sunday);
  const m1 = MONTHS_FR[A.m - 1];
  const m2 = MONTHS_FR[B.m - 1];
  if (A.m === B.m && A.y === B.y) {
    return `${A.d} – ${B.d} ${m1} ${B.y}`;
  }
  return `${A.d} ${m1} – ${B.d} ${m2} ${B.y}`;
}

function formatTime(iso: string) {
  return formatParisTime(iso, "HH:mm");
}

function formatDateLong(iso: string) {
  return formatParisTime(iso, "date");
}

// ─── Statut styles ────────────────────────────────────────────────────────────

type StatutStyle = { bg: string; text: string; ring: string; label: string };

function statutStyle(statut: string): StatutStyle {
  switch (statut) {
    case "confirmee":
      return {
        bg: "bg-[#27AE60]/10",
        text: "text-[#27AE60]",
        ring: "ring-[#27AE60]/25",
        label: "Confirmée",
      };
    case "en_attente":
      return {
        bg: "bg-amber-50",
        text: "text-amber-700",
        ring: "ring-amber-200",
        label: "En attente",
      };
    case "annulee":
      return {
        bg: "bg-slate-100",
        text: "text-slate-500",
        ring: "ring-slate-200",
        label: "Annulée",
      };
    case "terminee":
      return {
        bg: "bg-[#2E75B6]/10",
        text: "text-[#2E75B6]",
        ring: "ring-[#2E75B6]/25",
        label: "Terminée",
      };
    default:
      return {
        bg: "bg-slate-100",
        text: "text-slate-500",
        ring: "ring-slate-200",
        label: statut,
      };
  }
}

// ─── Drawer latéral ───────────────────────────────────────────────────────────

type DrawerProps = {
  seance: Seance;
  sophrologueId: string;
  plan: string | null;
  onClose: () => void;
  onMarkDone: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onLienVisioUpdated: (id: string, lien: string) => void;
};

function resolveTypeSeance(type_seance: Seance["type_seance"]): {
  nom: string;
  mode: string | null;
} {
  const row = Array.isArray(type_seance) ? type_seance[0] : type_seance;
  return {
    nom: row?.nom ?? "Séance",
    mode: row?.mode ?? null,
  };
}

function SeanceDrawer({
  seance,
  sophrologueId,
  plan,
  onClose,
  onMarkDone,
  onCancel,
  onLienVisioUpdated,
}: DrawerProps) {
  const [acting, setActing] = useState<"done" | "cancel" | null>(null);
  const [lienVisio, setLienVisio] = useState(
    seance.lien_teleconsultation?.trim() || null,
  );
  const [visioActing, setVisioActing] = useState<"copy" | "regen" | null>(null);
  const [visioError, setVisioError] = useState<string | null>(null);
  const [visioCopied, setVisioCopied] = useState(false);
  const st = statutStyle(seance.statut);

  useEffect(() => {
    setLienVisio(seance.lien_teleconsultation?.trim() || null);
    setVisioError(null);
    setVisioCopied(false);
  }, [seance.id, seance.lien_teleconsultation]);

  const nomPatient =
    `${seance.patient?.prenom ?? ""} ${seance.patient?.nom ?? ""}`.trim() ||
    "Client inconnu";

  const paiementRow = resolvePaiement(seance.paiement);
  const montant = paiementRow?.montant_total ?? null;
  const factureUrl = paiementRow?.facture_url ?? null;

  const { nom: typeNom, mode: typeMode } = resolveTypeSeance(seance.type_seance);
  const isVisio = typeMode === "visio";

  const email = seance.patient?.email ?? null;
  const tel = seance.patient?.telephone ?? null;

  const handleDone = async () => {
    setActing("done");
    await onMarkDone(seance.id);
    setActing(null);
  };

  const handleCancel = async () => {
    setActing("cancel");
    await onCancel(seance.id);
    setActing(null);
  };

  const handleCopyLien = async () => {
    if (!lienVisio) return;
    setVisioError(null);
    setVisioActing("copy");
    try {
      await navigator.clipboard.writeText(lienVisio);
      setVisioCopied(true);
      setTimeout(() => setVisioCopied(false), 2000);
    } catch {
      setVisioError("Impossible de copier le lien.");
    } finally {
      setVisioActing(null);
    }
  };

  const handleRegenererVisio = async () => {
    setVisioError(null);
    setVisioActing("regen");
    try {
      const res = await fetch(`/api/seances/${seance.id}/regenerer-visio`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => null)) as {
        lien_teleconsultation?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        setVisioError(json?.error ?? "Échec de la régénération du lien.");
        return;
      }
      const url = json?.lien_teleconsultation?.trim();
      if (!url) {
        setVisioError("Réponse invalide : lien manquant.");
        return;
      }
      setLienVisio(url);
      onLienVisioUpdated(seance.id, url);
    } catch {
      setVisioError("Erreur réseau lors de la régénération.");
    } finally {
      setVisioActing(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-[#1E3A5F]">
            Détails de la séance
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${st.bg} ${st.text} ${st.ring}`}
            >
              {st.label}
            </span>
            {isVisio && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF3DE] px-3 py-1 text-xs font-semibold text-[#426F59]">
                <Video className="h-3.5 w-3.5" />
                Visio
              </span>
            )}
          </div>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Client
            </p>
            <p className="text-lg font-semibold text-[#1E3A5F]">{nomPatient}</p>
            {email && (
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-2 text-sm text-[#2E75B6] hover:underline"
              >
                <Mail className="h-4 w-4" /> {email}
              </a>
            )}
            {tel && (
              <a
                href={`tel:${tel}`}
                className="flex items-center gap-2 text-sm text-slate-600 hover:underline"
              >
                <Phone className="h-4 w-4 text-slate-400" /> {tel}
              </a>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Séance
            </p>
            <DrawerRow label="Type" value={typeNom} />
            <DrawerRow
              label="Date"
              value={formatDateLong(seance.debut_at)}
              icon={<CalendarDays className="h-4 w-4 text-slate-400" />}
            />
            <DrawerRow
              label="Heure"
              value={`${formatTime(seance.debut_at)} – ${formatTime(seance.fin_at)}`}
              icon={<Clock className="h-4 w-4 text-slate-400" />}
            />
            {montant !== null && (
              <DrawerRow label="Montant" value={`${montant.toFixed(2)} €`} />
            )}
            {(seance.statut === "confirmee" || seance.statut === "terminee") && (
              <div className="pt-2">
                <BoutonFacture seanceId={seance.id} factureUrl={factureUrl} />
              </div>
            )}
          </section>

          {isVisio && (
            <section className="space-y-3 rounded-xl border border-[#426F59]/20 bg-[#F0F7F4] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#426F59]">
                Visioconférence
              </p>
              {lienVisio ? (
                <>
                  <p className="break-all text-xs text-slate-600">{lienVisio}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-[#426F59]/30"
                    onClick={handleCopyLien}
                    disabled={visioActing !== null}
                  >
                    {visioActing === "copy" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        {visioCopied ? "Lien copié" : "Copier le lien"}
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleRegenererVisio}
                  disabled={visioActing !== null}
                >
                  {visioActing === "regen" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Régénérer le lien
                    </>
                  )}
                </Button>
              )}
              {visioError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {visioError}
                </p>
              )}
            </section>
          )}

          {(seance.statut === "confirmee" || seance.statut === "terminee") &&
            seance.patient_id && (
              <section className="border-t border-[#d1d5db] pt-4">
                <PlanGuard
                  requiredPlan="professionnel"
                  currentPlan={normalizePlan(plan)}
                  featureName="Notes de séance"
                >
                  <NoteSeance
                    seanceId={seance.id}
                    patientId={seance.patient_id}
                    sophrologueId={sophrologueId}
                  />
                </PlanGuard>
              </section>
            )}
        </div>

        {seance.statut === "confirmee" && (
          <div className="space-y-2 border-t border-slate-100 px-6 py-4">
            <Button
              className="w-full"
              onClick={handleDone}
              disabled={acting !== null}
            >
              {acting === "done" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Marquer comme terminée
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full border-red-200 text-red-600 hover:bg-red-50"
              onClick={handleCancel}
              disabled={acting !== null}
            >
              {acting === "cancel" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Annuler la séance
                </>
              )}
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}

function DrawerRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}

// ─── Calendrier client ────────────────────────────────────────────────────────

type SeancesCalendarProps = {
  sophrologueId: string;
  plan: string | null;
  initialWeekStartIso: string;
  initialSeances: Seance[];
};

export default function SeancesCalendar({
  sophrologueId,
  plan,
  initialWeekStartIso,
  initialSeances,
}: SeancesCalendarProps) {
  const [seances, setSeances] = useState<Seance[]>(initialSeances);
  const [loading, setLoading] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(
    () => new Date(initialWeekStartIso),
  );
  const [selected, setSelected] = useState<Seance | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Skip le premier fetch : les données initiales viennent du Server Component
  const skipNextFetch = useRef(true);
  const supabase = createSupabaseBrowserClient();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 7);

  const loadSeances = useCallback(
    async (sid: string, from: Date, to: Date) => {
      setLoading(true);
      const { data } = await supabase
        .from("seances")
        .select(SEANCES_SELECT)
        .eq("sophrologue_id", sid)
        .gte("debut_at", from.toISOString())
        .lt("debut_at", to.toISOString())
        .order("debut_at")
        .returns<Seance[]>();

      setSeances(data ?? []);
      setLoading(false);
    },
    [supabase],
  );

  // Recharger uniquement quand la semaine change (pas au mount)
  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    void loadSeances(sophrologueId, weekStart, weekEnd);
    // weekEnd dérivé de weekStart — volontairement hors deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, sophrologueId, loadSeances]);

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToday = () => setWeekStart(startOfWeekParisMonday(new Date()));

  function seancesFor(day: Date, hour: number): Seance[] {
    return seances.filter((s) => {
      const d = new Date(s.debut_at);
      return isSameDay(d, day) && getParisHour(d) === hour;
    });
  }

  const handleMarkDone = async (id: string) => {
    await fetch("/api/seances/update-statut", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seance_id: id, statut: "terminee" }),
    });
    setSeances((prev) =>
      prev.map((s) => (s.id === id ? { ...s, statut: "terminee" } : s)),
    );
    setSelected((prev) =>
      prev?.id === id ? { ...prev, statut: "terminee" } : prev,
    );
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch("/api/reservations/annuler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seance_id: id, annule_par: "sophrologue" }),
      });
      const json = await res.json();

      if (!res.ok) {
        showToast(json.error ?? "L'annulation a échoué.", "error");
        return;
      }

      setSeances((prev) =>
        prev.map((s) => (s.id === id ? { ...s, statut: "annulee" } : s)),
      );
      setSelected((prev) =>
        prev?.id === id ? { ...prev, statut: "annulee" } : prev,
      );

      const remboursé = json.montant_rembourse;
      showToast(
        remboursé > 0
          ? `Séance annulée. Remboursement de ${remboursé.toFixed(2)} € initié.`
          : "Séance annulée (aucun remboursement applicable).",
        "success",
      );

      await loadSeances(sophrologueId, weekStart, weekEnd);
    } catch {
      showToast("Erreur réseau lors de l'annulation.", "error");
    }
  };

  const today = new Date();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">Mon agenda</h1>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={goToday}>
              Aujourd&apos;hui
            </Button>
            <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-sm">
              <button
                onClick={prevWeek}
                className="flex h-9 w-9 items-center justify-center rounded-l-lg text-slate-500 hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-4 text-sm font-medium text-slate-700">
                {formatWeekRange(weekStart)}
              </span>
              <button
                onClick={nextWeek}
                className="flex h-9 w-9 items-center justify-center rounded-r-lg text-slate-500 hover:bg-slate-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Légende :</span>
          {(["confirmee", "en_attente", "terminee", "annulee"] as const).map((statut) => {
            const st = statutStyle(statut);
            return (
              <span
                key={statut}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${st.bg} ${st.ring} ${st.text}`}
              >
                {st.label}
              </span>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#2E75B6]" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200">
                <div className="py-3" />
                {weekDays.map((day, i) => {
                  const isToday = isSameDay(day, today);
                  return (
                    <div
                      key={i}
                      className="border-l border-slate-100 py-3 text-center"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {DAYS_FR[i]}
                      </p>
                      <p
                        className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                          isToday
                            ? "bg-[#2E75B6] text-white"
                            : "text-slate-700"
                        }`}
                      >
                        {getParisYMD(day).d}
                      </p>
                    </div>
                  );
                })}
              </div>

              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-start justify-end pr-3 pt-2">
                    <span className="text-xs text-slate-400">{hour}h</span>
                  </div>

                  {weekDays.map((day, di) => {
                    const slots = seancesFor(day, hour);
                    return (
                      <div
                        key={di}
                        className="min-h-[52px] min-w-0 border-l border-slate-100 p-1"
                      >
                        {slots.map((s) => {
                          const st = statutStyle(s.statut);
                          const nomPatient =
                            `${s.patient?.prenom ?? ""} ${s.patient?.nom ?? ""}`.trim() ||
                            "Client";
                          const { nom: typeNom, mode: typeMode } =
                            resolveTypeSeance(s.type_seance);
                          return (
                            <button
                              key={s.id}
                              onClick={() => setSelected(s)}
                              className={`w-full rounded-lg px-2 py-1.5 text-left ring-1 transition-opacity hover:opacity-80 ${st.bg} ${st.ring}`}
                            >
                              <p
                                className={`truncate text-xs font-semibold ${st.text}`}
                              >
                                {nomPatient}
                                {typeMode === "visio" && (
                                  <span className="ml-1 font-medium text-[#426F59]">
                                    · Visio
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-[10px] text-slate-500">
                                {formatTime(s.debut_at)} · {typeNom}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <SeanceDrawer
          seance={selected}
          sophrologueId={sophrologueId}
          plan={plan}
          onClose={() => setSelected(null)}
          onMarkDone={handleMarkDone}
          onCancel={handleCancel}
          onLienVisioUpdated={(id, lien) => {
            setSeances((prev) =>
              prev.map((s) =>
                s.id === id ? { ...s, lien_teleconsultation: lien } : s,
              ),
            );
            setSelected((prev) =>
              prev && prev.id === id
                ? { ...prev, lien_teleconsultation: lien }
                : prev,
            );
          }}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-[#27AE60] text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
