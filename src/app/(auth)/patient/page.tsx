"use client";

import { useEffect, useState, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  Download,
  XCircle,
  Loader2,
  Pencil,
  Check,
  X,
  AlertCircle,
  CalendarDays,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatParisTime } from "@/lib/timezone";

// ─── Types ────────────────────────────────────────────────────────────────────

type Patient = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  user_id: string | null;
};

type Seance = {
  id: string;
  debut_at: string;
  fin_at: string;
  statut: string;
  sophrologue: {
    prenom: string | null;
    nom: string | null;
    adresse: string | null;
    ville: string | null;
  } | null;
  type_seance: { nom: string | null } | null;
  paiement: { montant_total: number | null; facture_url: string | null } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLong(iso: string) {
  return formatParisTime(iso, "date");
}

function formatDateShort(iso: string) {
  return formatParisTime(iso, "dateShort");
}

function formatTime(iso: string) {
  return formatParisTime(iso, "HH:mm");
}

function capitalize(s: string | null | undefined) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function resolveOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function statutStyle(statut: string) {
  switch (statut) {
    case "confirmee":
      return "bg-[#27AE60]/10 text-[#27AE60] ring-[#27AE60]/20";
    case "en_attente":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "annulee":
      return "bg-red-50 text-red-600 ring-red-200";
    case "terminee":
      return "bg-[#2E75B6]/10 text-[#2E75B6] ring-[#2E75B6]/20";
    default:
      return "bg-slate-100 text-slate-500 ring-slate-200";
  }
}

function statutLabel(statut: string) {
  const map: Record<string, string> = {
    confirmee: "Confirmée",
    en_attente: "En attente",
    annulee: "Annulée",
    terminee: "Terminée",
  };
  return map[statut] ?? statut;
}

// ─── Composant : card prochain RDV ────────────────────────────────────────────

function RdvCard({ seance, onCancel }: { seance: Seance; onCancel: (id: string) => void }) {
  const sophrologue = resolveOne(seance.sophrologue);
  const typeSeance = resolveOne(seance.type_seance);
  const paiement = resolveOne(seance.paiement);
  const nomSophro =
    `${sophrologue?.prenom ?? ""} ${sophrologue?.nom ?? ""}`.trim() || "Sophrologue";
  const adresse = [sophrologue?.adresse, sophrologue?.ville].filter(Boolean).join(", ") || null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* Statut */}
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statutStyle(seance.statut)}`}
      >
        {statutLabel(seance.statut)}
      </span>

      <div className="mt-3 space-y-2">
        {/* Sophrologue */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E3A5F]/10">
            <User className="h-4 w-4 text-[#1E3A5F]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1E3A5F]">{nomSophro}</p>
            {adresse && <p className="text-xs text-slate-500">{adresse}</p>}
          </div>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span>{capitalize(formatDateLong(seance.debut_at))}</span>
        </div>

        {/* Heure */}
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <Clock className="h-4 w-4 text-slate-400" />
          <span>
            {formatTime(seance.debut_at)} – {formatTime(seance.fin_at)}
          </span>
        </div>

        {/* Type + montant */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500">
            {typeSeance?.nom ?? "Séance de sophrologie"}
          </span>
          {paiement?.montant_total != null && (
            <span className="text-sm font-semibold text-[#27AE60]">
              {paiement.montant_total.toFixed(2)} €
            </span>
          )}
        </div>
      </div>

      {/* Bouton annulation */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <button
          onClick={() => onCancel(seance.id)}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700"
        >
          <XCircle className="h-4 w-4" />
          Annuler ce rendez-vous
        </button>
      </div>
    </div>
  );
}

// ─── Composant : section "Mes informations" avec édition inline ───────────────

function InfoSection({ patient }: { patient: Patient }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    prenom: patient.prenom ?? "",
    nom: patient.nom ?? "",
    email: patient.email ?? "",
    telephone: patient.telephone ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originalRef = useRef(form);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/patients/update-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: patient.id, ...form }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Une erreur est survenue.");
        return;
      }
      originalRef.current = { ...form };
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Impossible de sauvegarder.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({ ...originalRef.current });
    setEditing(false);
    setError(null);
  };

  const fields: { key: keyof typeof form; label: string; type: string; icon: React.ReactNode }[] = [
    { key: "prenom", label: "Prénom", type: "text", icon: <User className="h-4 w-4 text-[#2E75B6]" /> },
    { key: "nom", label: "Nom", type: "text", icon: <User className="h-4 w-4 text-[#2E75B6]" /> },
    { key: "email", label: "Email", type: "email", icon: <Mail className="h-4 w-4 text-[#2E75B6]" /> },
    { key: "telephone", label: "Téléphone", type: "tel", icon: <Phone className="h-4 w-4 text-[#2E75B6]" /> },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Mes informations
        </h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-sm text-[#2E75B6] hover:text-[#1E3A5F]"
          >
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" /> Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 text-sm font-medium text-[#27AE60] hover:text-green-700"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Enregistrer
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {saved && (
        <p className="mb-3 rounded-lg bg-[#27AE60]/10 px-3 py-2 text-sm text-[#27AE60]">
          Informations mises à jour.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(({ key, label, type, icon }) => (
          <div key={key} className="flex items-start gap-3">
            <div className="mt-1 shrink-0">{icon}</div>
            <div className="flex-1">
              <p className="mb-1 text-xs text-slate-400">{label}</p>
              {editing ? (
                <Input
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              ) : (
                <p className="text-sm font-medium text-slate-800">
                  {form[key] || <span className="text-slate-400">—</span>}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Traduction des erreurs Supabase ──────────────────────────────────────────

function translateError(message: string): string {
  if (message.includes("New password should be different"))
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (message.includes("Password should be at least"))
    return "Le mot de passe doit contenir au moins 8 caractères.";
  if (message.includes("Auth session missing"))
    return "Session expirée. Veuillez vous reconnecter.";
  return "Une erreur est survenue. Veuillez réessayer.";
}

// ─── Composant : changement de mot de passe ───────────────────────────────────

function ChangePasswordSection() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(translateError(updateError.message));
      return;
    }
    setSuccess(true);
    setPassword("");
    setConfirm("");
    setTimeout(() => {
      setSuccess(false);
      setOpen(false);
    }, 3000);
  };

  const handleCancel = () => {
    setOpen(false);
    setPassword("");
    setConfirm("");
    setError(null);
    setSuccess(false);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F0F7F4]">
            <KeyRound className="h-4 w-4 text-[#426F59]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Mot de passe
            </h2>
            <p className="text-xs text-slate-400">Modifier votre mot de passe de connexion</p>
          </div>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-sm text-[#426F59] hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-800">
              Nouveau mot de passe
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 caractères"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-800">
              Confirmer le mot de passe
            </label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Répétez le mot de passe"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg bg-[#F0F7F4] px-3 py-2 text-sm font-medium text-[#426F59]">
              ✓ Mot de passe mis à jour avec succès.
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={saving} size="sm">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Mettre à jour"
              )}
            </Button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type AuthUserMeta = {
  id: string;
  email: string | undefined;
  user_metadata: Record<string, string>;
};

export default function PatientSpacePage() {
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [authUser, setAuthUser] = useState<AuthUserMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [upcomingSeances, setUpcomingSeances] = useState<Seance[]>([]);
  const [pastSeances, setPastSeances] = useState<Seance[]>([]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => {
    let cancelled = false;

    // Timeout de sécurité : 8 secondes max
    const timeout = setTimeout(() => {
      if (!cancelled) {
        console.error("[patient/page] Timeout — chargement trop long");
        setLoadError("Le chargement a pris trop de temps. Vérifiez votre connexion.");
        setLoading(false);
      }
    }, 8000);

    const load = async () => {
      console.log("[patient/page] Début chargement");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      console.log("[patient/page] Auth user:", user?.id ?? "non connecté", authError ?? "");

      if (!user || cancelled) {
        clearTimeout(timeout);
        if (!cancelled) {
          setLoadError("Vous devez être connecté pour accéder à cette page.");
          setLoading(false);
        }
        return;
      }

      setAuthUser({
        id: user.id,
        email: user.email,
        user_metadata: (user.user_metadata as Record<string, string>) ?? {},
      });

      // Chargement dashboard UNIQUEMENT via l’API (service role + session cookies).
      // Aucun supabase.from('patients'|'seances') ici — la RLS masquerait les lignes.
      console.log("[patient] calling /api/patient/space");
      const spaceRes = await fetch("/api/patient/space", {
        credentials: "include",
      });
      const spaceJson = (await spaceRes.json().catch(() => null)) as
        | {
            patient: Patient | null;
            upcoming: Seance[];
            past: Seance[];
            error?: string;
          }
        | null;

      if (cancelled) {
        clearTimeout(timeout);
        return;
      }

      if (!spaceRes.ok) {
        setLoadError(
          spaceJson?.error ??
            (spaceRes.status === 401
              ? "Vous devez être connecté pour accéder à cette page."
              : "Impossible de charger votre espace. Merci de réessayer."),
        );
        setLoading(false);
        clearTimeout(timeout);
        return;
      }

      if (!spaceJson) {
        setLoadError("Réponse invalide du serveur.");
        setLoading(false);
        clearTimeout(timeout);
        return;
      }

      if (!spaceJson.patient) {
        console.log("[patient/page] Aucune fiche patient — nouveau client sans réservation");
        setPatient(null);
        setUpcomingSeances([]);
        setPastSeances([]);
        setLoading(false);
        clearTimeout(timeout);
        return;
      }

      console.log(
        "[patient/page] Espace chargé (API) — patient:",
        spaceJson.patient.id,
        "| RDV à venir:",
        spaceJson.upcoming?.length ?? 0,
        "| passés:",
        spaceJson.past?.length ?? 0,
      );

      setPatient(spaceJson.patient);
      setUpcomingSeances(spaceJson.upcoming ?? []);
      setPastSeances(spaceJson.past ?? []);
      setLoading(false);
      clearTimeout(timeout);
    };

    load().catch((err) => {
      console.error("[patient/page] Erreur inattendue dans load():", err);
      if (!cancelled) {
        setLoadError("Une erreur inattendue est survenue.");
        setLoading(false);
        clearTimeout(timeout);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [supabase]);

  const handleCancelRdv = (seanceId: string) => {
    router.push(`/patient/annulation/${seanceId}`);
  };

  // ── États de chargement / accès ─────────────────────────────────────────────

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#2E75B6]" />
          <p className="text-sm text-slate-500">Chargement de votre espace…</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <h1 className="mb-2 text-lg font-semibold text-[#1E3A5F]">
            Erreur de chargement
          </h1>
          <p className="mb-4 text-sm text-slate-500">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm font-medium text-[#2E75B6] hover:underline"
          >
            Réessayer
          </button>
        </div>
      </main>
    );
  }

  // Derive display name: patient record → auth metadata → email prefix → fallback
  const prenom =
    patient?.prenom ||
    authUser?.user_metadata?.prenom ||
    (authUser?.email ? authUser.email.split("@")[0] : null) ||
    "vous";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl space-y-10 px-4 py-10">
        {/* ── Section 1 : En-tête ───────────────────────────────────────── */}
        <div>
          <p className="text-sm text-slate-500">Bienvenue,</p>
          <h1 className="text-3xl font-semibold text-[#1E3A5F]">
            Mon espace, {capitalize(prenom)}
          </h1>
        </div>

        {/* ── Section 2 : Prochains RDV ─────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">
              Prochains rendez-vous
            </h2>
            <span className="text-sm text-slate-500">
              {upcomingSeances.length} à venir
            </span>
          </div>

          {upcomingSeances.length === 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8">
              <div className="flex items-center gap-3 text-slate-500">
                <Calendar className="h-5 w-5 shrink-0 text-slate-300" />
                <p className="text-sm">Aucun rendez-vous à venir.</p>
              </div>
              <a
                href="/"
                className="btn-primary inline-flex items-center gap-2 rounded-lg bg-[#426F59] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#355849] hover:shadow-md"
              >
                <CalendarDays className="h-4 w-4" />
                Trouver un sophrologue
              </a>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {upcomingSeances.map((s) => (
                <RdvCard key={s.id} seance={s} onCancel={handleCancelRdv} />
              ))}
            </div>
          )}
        </section>

        {/* ── Section 3 : Historique ────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[#1E3A5F]">
            Historique des séances
          </h2>

          {pastSeances.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucune séance passée pour l'instant.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Header */}
              <div className="hidden grid-cols-[1.5fr_2fr_1.5fr_1fr_1fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 md:grid">
                {["Date", "Sophrologue", "Type", "Statut", "Montant", ""].map(
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

              <div className="divide-y divide-slate-100">
                {pastSeances.map((s) => {
                  const sophrologue = resolveOne(s.sophrologue);
                  const typeSeance = resolveOne(s.type_seance);
                  const paiement = resolveOne(s.paiement);
                  const nomSophro =
                    `${sophrologue?.prenom ?? ""} ${sophrologue?.nom ?? ""}`.trim() ||
                    "—";
                  return (
                    <div
                      key={s.id}
                      className="grid grid-cols-1 gap-1 px-5 py-3 md:grid-cols-[1.5fr_2fr_1.5fr_1fr_1fr_auto] md:items-center md:gap-4"
                    >
                      {/* Date */}
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {formatDateShort(s.debut_at)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatTime(s.debut_at)}
                        </p>
                      </div>

                      {/* Sophrologue */}
                      <span className="text-sm text-slate-700">{nomSophro}</span>

                      {/* Type */}
                      <span className="text-sm text-slate-500">
                        {typeSeance?.nom ?? "Séance"}
                      </span>

                      {/* Statut */}
                      <span
                        className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statutStyle(s.statut)}`}
                      >
                        {statutLabel(s.statut)}
                      </span>

                      {/* Montant */}
                      <span className="text-sm font-medium text-slate-800">
                        {paiement?.montant_total != null
                          ? `${paiement.montant_total.toFixed(2)} €`
                          : "—"}
                      </span>

                      {/* Facture */}
                      {paiement?.facture_url ? (
                        <a
                          href={paiement.facture_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs font-medium text-[#2E75B6] hover:text-[#1E3A5F]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Facture
                        </a>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ── Section 4 : Mes informations ──────────────────────────────── */}
        {patient ? (
          <InfoSection patient={patient} />
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Mes informations
            </h2>
            <div className="flex items-start gap-3">
              <Mail className="mt-1 h-4 w-4 shrink-0 text-[#426F59]" />
              <div>
                <p className="mb-1 text-xs text-slate-400">Email</p>
                <p className="text-sm font-medium text-slate-800">
                  {authUser?.email ?? "—"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Vos informations complètes seront disponibles après votre première réservation.
            </p>
          </section>
        )}

        {/* ── Section 5 : Mot de passe ──────────────────────────────────── */}
        <ChangePasswordSection />
      </div>
    </main>
  );
}
