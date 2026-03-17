"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  Calendar,
  Euro,
  TrendingUp,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

type Seance = {
  id: string;
  debut_at: string;
  fin_at: string;
  statut: string;
  patient: { prenom: string | null; nom: string | null } | null;
  type_seance: { nom: string | null } | null;
};

type Paiement = {
  montant_sophrologue: number;
  created_at: string;
};

type Patient = {
  id: string;
  created_at: string;
};

type KpiData = {
  rdvMois: number;
  caMois: number;
  tauxOccupation: number;
  nouveauxPatients: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDateShort(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
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
      return "Confirmé";
    case "en_attente":
      return "En attente";
    case "annulee":
      return "Annulé";
    default:
      return statut;
  }
}

// ─── Composant KPI Card ───────────────────────────────────────────────────────

function KpiCard({
  icon,
  title,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">{title}</span>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}
        >
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-[#1E3A5F]">{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </Card>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [sophrologueId, setSophrologueId] = useState<string | null>(null);
  const [kpi, setKpi] = useState<KpiData>({
    rdvMois: 0,
    caMois: 0,
    tauxOccupation: 0,
    nouveauxPatients: 0,
  });
  const [seancesAujourdhui, setSeancesAujourdhui] = useState<Seance[]>([]);
  const [prochainsRdv, setProchainsRdv] = useState<Seance[]>([]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // 1) Récupérer l'utilisateur connecté
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // 2) Récupérer l'ID du sophrologue
      const { data: sophrologue } = await supabase
        .from("sophrologues")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle<{ id: string }>();

      if (!sophrologue || cancelled) return;
      setSophrologueId(sophrologue.id);

      const sid = sophrologue.id;

      // Bornes du mois courant
      const now = new Date();
      const debutMois = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const finMois = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      // Bornes d'aujourd'hui
      const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const finJour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

      // Début des 7 prochains jours (dès maintenant)
      const dans7Jours = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // 3) KPI 1 : RDV ce mois (confirmées)
      const { count: rdvMois } = await supabase
        .from("seances")
        .select("id", { count: "exact", head: true })
        .eq("sophrologue_id", sid)
        .eq("statut", "confirmee")
        .gte("debut_at", debutMois)
        .lte("debut_at", finMois);

      // 4) KPI 2 : CA ce mois
      const { data: paiements } = await supabase
        .from("paiements")
        .select("montant_sophrologue, created_at")
        .eq("sophrologue_id", sid)
        .eq("statut", "reussi")
        .gte("created_at", debutMois)
        .lte("created_at", finMois)
        .returns<Paiement[]>();

      const caMois = (paiements ?? []).reduce(
        (sum, p) => sum + (p.montant_sophrologue ?? 0),
        0,
      );

      // 5) KPI 3 : Taux occupation (base 20 créneaux/mois)
      const rdvCount = rdvMois ?? 0;
      const tauxOccupation = Math.min(Math.round((rdvCount / 20) * 100), 100);

      // 6) KPI 4 : Nouveaux patients ce mois
      const { count: nouveauxPatients } = await supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("sophrologue_id", sid)
        .gte("created_at", debutMois)
        .lte("created_at", finMois);

      // 7) Séances du jour
      const { data: seancesJour } = await supabase
        .from("seances")
        .select(
          "id, debut_at, fin_at, statut, patient:patients(prenom, nom), type_seance:types_seances(nom)",
        )
        .eq("sophrologue_id", sid)
        .neq("statut", "annulee")
        .gte("debut_at", debutJour)
        .lte("debut_at", finJour)
        .order("debut_at")
        .returns<Seance[]>();

      // 8) Prochains RDV (7 jours, hors aujourd'hui)
      const { data: prochainsData } = await supabase
        .from("seances")
        .select(
          "id, debut_at, fin_at, statut, patient:patients(prenom, nom), type_seance:types_seances(nom)",
        )
        .eq("sophrologue_id", sid)
        .neq("statut", "annulee")
        .gt("debut_at", finJour)
        .lte("debut_at", dans7Jours)
        .order("debut_at")
        .limit(5)
        .returns<Seance[]>();

      if (!cancelled) {
        setKpi({
          rdvMois: rdvCount,
          caMois: Math.round(caMois * 100) / 100,
          tauxOccupation,
          nouveauxPatients: nouveauxPatients ?? 0,
        });
        setSeancesAujourdhui(seancesJour ?? []);
        setProchainsRdv(prochainsData ?? []);
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        {/* Titre */}
        <div className="space-y-1">
          <Badge>Calymia</Badge>
          <h1 className="text-3xl font-semibold text-[#1E3A5F]">
            Tableau de bord
          </h1>
          <p className="text-sm text-slate-500">
            Vue d'ensemble de votre activité du mois.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#2E75B6]" />
          </div>
        ) : (
          <>
            {/* ── Section 1 : KPIs ─────────────────────────────────────────── */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Ce mois-ci
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  icon={<Calendar className="h-5 w-5 text-[#2E75B6]" />}
                  title="RDV confirmés"
                  value={String(kpi.rdvMois)}
                  sub="séances ce mois"
                  accent="bg-[#2E75B6]/10"
                />
                <KpiCard
                  icon={<Euro className="h-5 w-5 text-[#27AE60]" />}
                  title="CA net"
                  value={`${kpi.caMois.toFixed(0)} €`}
                  sub="après commission Calymia"
                  accent="bg-[#27AE60]/10"
                />
                <KpiCard
                  icon={<TrendingUp className="h-5 w-5 text-[#1E3A5F]" />}
                  title="Taux d'occupation"
                  value={`${kpi.tauxOccupation} %`}
                  sub="base : 20 créneaux/mois"
                  accent="bg-[#1E3A5F]/10"
                />
                <KpiCard
                  icon={<Users className="h-5 w-5 text-amber-600" />}
                  title="Nouveaux patients"
                  value={String(kpi.nouveauxPatients)}
                  sub="inscrits ce mois"
                  accent="bg-amber-50"
                />
              </div>
            </section>

            {/* ── Section 2 : RDV du jour ───────────────────────────────────── */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Rendez-vous aujourd'hui
              </h2>
              <Card className="divide-y divide-slate-100 p-0 overflow-hidden">
                {seancesAujourdhui.length === 0 ? (
                  <div className="flex items-center gap-3 px-5 py-6 text-sm text-slate-500">
                    <CheckCircle2 className="h-5 w-5 text-slate-300" />
                    Aucun rendez-vous aujourd'hui
                  </div>
                ) : (
                  seancesAujourdhui.map((s) => {
                    const nomPatient =
                      `${s.patient?.prenom ?? ""} ${s.patient?.nom ?? ""}`.trim() ||
                      "Patient inconnu";
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between px-5 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2E75B6]/10">
                            <Clock className="h-4 w-4 text-[#2E75B6]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {nomPatient}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatTime(s.debut_at)} —{" "}
                              {s.type_seance?.nom ?? "Séance"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statutColor(
                            s.statut,
                          )}`}
                        >
                          {statutLabel(s.statut)}
                        </span>
                      </div>
                    );
                  })
                )}
              </Card>
            </section>

            {/* ── Section 3 : Prochains RDV ────────────────────────────────── */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Prochains rendez-vous (7 jours)
              </h2>
              <Card className="divide-y divide-slate-100 p-0 overflow-hidden">
                {prochainsRdv.length === 0 ? (
                  <div className="flex items-center gap-3 px-5 py-6 text-sm text-slate-500">
                    <AlertCircle className="h-5 w-5 text-slate-300" />
                    Aucun rendez-vous dans les 7 prochains jours
                  </div>
                ) : (
                  prochainsRdv.map((s) => {
                    const nomPatient =
                      `${s.patient?.prenom ?? ""} ${s.patient?.nom ?? ""}`.trim() ||
                      "Patient inconnu";
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between px-5 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-center min-w-[48px]">
                            <p className="text-xs font-medium uppercase text-[#2E75B6]">
                              {formatDateShort(s.debut_at)}
                            </p>
                            <p className="text-sm font-semibold text-[#1E3A5F]">
                              {formatTime(s.debut_at)}
                            </p>
                          </div>
                          <div className="h-8 w-px bg-slate-200" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {nomPatient}
                            </p>
                            <p className="text-xs text-slate-500">
                              {s.type_seance?.nom ?? "Séance"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statutColor(
                            s.statut,
                          )}`}
                        >
                          {statutLabel(s.statut)}
                        </span>
                      </div>
                    );
                  })
                )}
              </Card>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
