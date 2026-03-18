"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import {
  Search,
  UserPlus,
  X,
  Loader2,
  User,
  ChevronRight,
  Users,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type Patient = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  created_at: string;
  nb_seances?: number;
  derniere_seance?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function initials(prenom: string | null, nom: string | null) {
  const p = prenom?.[0]?.toUpperCase() ?? "";
  const n = nom?.[0]?.toUpperCase() ?? "";
  return `${p}${n}` || "?";
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type ModalProps = {
  onClose: () => void;
  sophrologueId: string;
  onCreated: (patient: Patient) => void;
};

function NouveauPatientModal({ onClose, sophrologueId, onCreated }: ModalProps) {
  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.prenom.trim() || !form.nom.trim() || !form.email.trim()) {
      setError("Prénom, nom et email sont obligatoires.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patients/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sophrologue_id: sophrologueId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Une erreur est survenue.");
        return;
      }
      onCreated(json.patient);
      onClose();
    } catch {
      setError("Impossible de créer le patient.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-[#1E3A5F]">
            Nouveau client
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Prénom <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.prenom}
                onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                placeholder="Marie"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Nom <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="Dupont"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              Email <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="marie.dupont@email.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              Téléphone
            </label>
            <Input
              type="tel"
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              placeholder="06 12 34 56 78"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Ajouter le client"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

const LIMITE_ESSENTIEL = 15;

export default function ClientsPage() {
  const router = useRouter();
  const [sophrologueId, setSophrologueId] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filtered, setFiltered] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Filtre en temps réel
  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) {
      setFiltered(patients);
      return;
    }
    setFiltered(
      patients.filter(
        (p) =>
          `${p.prenom ?? ""} ${p.nom ?? ""}`.toLowerCase().includes(q) ||
          (p.email ?? "").toLowerCase().includes(q),
      ),
    );
  }, [search, patients]);

  const loadPatients = useCallback(
    async (sid: string) => {
      // Récupérer les patients
      const { data: rawPatients } = await supabase
        .from("patients")
        .select("id, prenom, nom, email, telephone, created_at")
        .eq("sophrologue_id", sid)
        .order("nom");

      if (!rawPatients) return;

      // Pour chaque patient : nb séances + dernière séance
      const enriched: Patient[] = await Promise.all(
        rawPatients.map(async (p) => {
          const { count } = await supabase
            .from("seances")
            .select("id", { count: "exact", head: true })
            .eq("patient_id", p.id)
            .eq("statut", "confirmee");

          const { data: lastSeance } = await supabase
            .from("seances")
            .select("debut_at")
            .eq("patient_id", p.id)
            .eq("statut", "confirmee")
            .order("debut_at", { ascending: false })
            .limit(1)
            .maybeSingle<{ debut_at: string }>();

          return {
            ...p,
            nb_seances: count ?? 0,
            derniere_seance: lastSeance?.debut_at ?? null,
          };
        }),
      );

      setPatients(enriched);
      setFiltered(enriched);
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: sophrologue } = await supabase
        .from("sophrologues")
        .select("id, plan")
        .eq("user_id", user.id)
        .maybeSingle<{ id: string; plan: string | null }>();

      if (!sophrologue || cancelled) return;
      setSophrologueId(sophrologue.id);
      setPlan(sophrologue.plan ?? null);
      await loadPatients(sophrologue.id);
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [supabase, loadPatients]);

  const handlePatientCreated = (patient: Patient) => {
    const enriched = { ...patient, nb_seances: 0, derniere_seance: null };
    setPatients((prev) => [...prev, enriched]);
  };

  const isEssentiel = plan?.toLowerCase() === "essentiel";
  const limitReached = isEssentiel && patients.length >= LIMITE_ESSENTIEL;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        {/* ── En-tête ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[#1E3A5F]">
              Mes clients
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {loading
                ? "Chargement…"
                : `${patients.length} client${patients.length !== 1 ? "s" : ""} au total${isEssentiel ? ` / ${LIMITE_ESSENTIEL} (plan Essentiel)` : ""}`}
            </p>
          </div>
          {!limitReached ? (
            <Button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Nouveau client
            </Button>
          ) : (
            <a
              href="/parametres"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
            >
              <ArrowUpRight className="h-4 w-4" />
              Passer au plan Professionnel
            </a>
          )}
        </div>

        {/* ── Bannière limite plan Essentiel ───────────────────────────── */}
        {limitReached && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Limite de {LIMITE_ESSENTIEL} clients atteinte
              </p>
              <p className="mt-0.5 text-sm text-amber-700">
                Votre plan Essentiel est limité à {LIMITE_ESSENTIEL} clients actifs. Passez au plan{" "}
                <a href="/parametres" className="font-medium underline">
                  Professionnel
                </a>{" "}
                pour en ajouter davantage.
              </p>
            </div>
          </div>
        )}

        {/* ── Avertissement approche de la limite ──────────────────────── */}
        {isEssentiel && !limitReached && patients.length >= LIMITE_ESSENTIEL - 3 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-5 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-700">
              Il vous reste{" "}
              <strong>{LIMITE_ESSENTIEL - patients.length}</strong> place
              {LIMITE_ESSENTIEL - patients.length > 1 ? "s" : ""} avant la limite du plan Essentiel.
            </p>
          </div>
        )}

        {/* ── Barre de recherche ───────────────────────────────────────── */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Rechercher par nom ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* ── Tableau ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#2E75B6]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center">
            <Users className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">
              {search
                ? "Aucun client ne correspond à votre recherche."
                : "Aucun client pour l'instant. Ajoutez votre premier client !"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Header */}
            <div className="hidden grid-cols-[2fr_2fr_1.5fr_1fr_1.5fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-6 py-3 md:grid">
              {["Nom complet", "Email", "Téléphone", "Séances", "Dernière séance", ""].map(
                (h) => (
                  <span
                    key={h}
                    className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                  >
                    {h}
                  </span>
                ),
              )}
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const nom = `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || "—";
                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-1 gap-2 px-6 py-4 transition-colors hover:bg-slate-50 md:grid-cols-[2fr_2fr_1.5fr_1fr_1.5fr_auto] md:items-center md:gap-4"
                  >
                    {/* Nom */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E3A5F]/10 text-xs font-bold text-[#1E3A5F]">
                        {initials(p.prenom, p.nom)}
                      </div>
                      <span className="font-medium text-slate-900">{nom}</span>
                    </div>

                    {/* Email */}
                    <span className="truncate text-sm text-slate-600 md:block">
                      {p.email ?? "—"}
                    </span>

                    {/* Téléphone */}
                    <span className="text-sm text-slate-600">
                      {p.telephone ?? "—"}
                    </span>

                    {/* Nb séances */}
                    <span className="text-sm font-medium text-slate-900">
                      {p.nb_seances}
                    </span>

                    {/* Dernière séance */}
                    <span className="text-sm text-slate-500">
                      {formatDate(p.derniere_seance)}
                    </span>

                    {/* Action */}
                    <button
                      onClick={() => router.push(`/clients/${p.id}`)}
                      className="flex items-center gap-1 text-xs font-medium text-[#2E75B6] hover:text-[#1E3A5F]"
                    >
                      Voir la fiche
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {showModal && sophrologueId && (
        <NouveauPatientModal
          sophrologueId={sophrologueId}
          onClose={() => setShowModal(false)}
          onCreated={handlePatientCreated}
        />
      )}
    </main>
  );
}
