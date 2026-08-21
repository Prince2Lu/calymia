"use client";

import { useCallback, useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { uploadAvatarWithSession } from "@/lib/supabase/upload-avatar-client";
import { CabinetVitrineTab } from "@/components/parametres/CabinetVitrineTab";
import { IntegrationsTab } from "@/components/parametres/IntegrationsTab";
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  Pencil,
  X,
  ToggleLeft,
  ToggleRight,
  User,
  Clock,
  CalendarDays,
  Images,
  ExternalLink,
  Copy,
  Check,
  Link2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSophrologueProfileUrl } from "@/lib/config/site-url";

// ─── Types ────────────────────────────────────────────────────────────────────

type Sophrologue = {
  id: string;
  user_id: string; // auth.users UUID — used for WHERE clause in updates
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  bio: string | null;
  specialites: string[] | null;
  certification_rncp: boolean;
  siret: string | null;
  lien_teleconsultation: string | null;
  adresse: string | null;
  ville: string | null;
  departement: string | null;
  slug: string | null;
  code_postal: string | null;
  photo_url: string | null;
  photos_cabinet: string[] | null;
  horaires: unknown;
  horaires_texte: string | null;
  infos_pratiques: string | null;
  modes_paiement: string[] | null;
  formations: string[] | null;
  certifications: string[] | null;
  syndicats: string[] | null;
  afficher_email: boolean;
  afficher_telephone: boolean;
};

const SOPHROLOGUE_SELECT =
  "id, user_id, prenom, nom, email, telephone, bio, specialites, certification_rncp, siret, lien_teleconsultation, adresse, ville, departement, slug, code_postal, photo_url, photos_cabinet, horaires, horaires_texte, infos_pratiques, modes_paiement, formations, certifications, syndicats, afficher_email, afficher_telephone";

type ModeSeance = "presentiel" | "visio";

type TypeSeance = {
  id: string;
  nom: string;
  duree_minutes: number;
  tarif: number;
  mode: ModeSeance;
  actif: boolean;
};

type ParamsCabinet = {
  delai_min_reservation_heures: number;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const DUREES = [30, 45, 60, 90];
const DELAIS = [
  { label: "6 heures", value: 6 },
  { label: "12 heures", value: 12 },
  { label: "24 heures", value: 24 },
  { label: "48 heures", value: 48 },
];

// ─── Helper toast ─────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{
    msg: string;
    ok: boolean | "neutral";
  } | null>(null);
  const show = useCallback((msg: string, ok: boolean | "neutral" = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);
  return { toast, show };
}

function Toast({
  toast,
}: {
  toast: { msg: string; ok: boolean | "neutral" } | null;
}) {
  if (!toast) return null;
  const tone =
    toast.ok === "neutral"
      ? "bg-slate-700 text-white"
      : toast.ok
        ? "bg-[#27AE60] text-white"
        : "bg-red-600 text-white";
  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${tone}`}
    >
      {toast.msg}
    </div>
  );
}

// ─── Tab navigation ───────────────────────────────────────────────────────────

type Tab =
  | "profil"
  | "seances"
  | "disponibilites"
  | "cabinet"
  | "integrations";

function isTab(value: string | null): value is Tab {
  return (
    value === "profil" ||
    value === "seances" ||
    value === "disponibilites" ||
    value === "cabinet" ||
    value === "integrations"
  );
}

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string; icon: React.ReactNode; shortLabel?: string }[] = [
    { key: "profil", label: "Mon profil", icon: <User className="h-4 w-4" /> },
    { key: "seances", label: "Types de séances", shortLabel: "Séances", icon: <Clock className="h-4 w-4" /> },
    { key: "disponibilites", label: "Disponibilités", shortLabel: "Dispo.", icon: <CalendarDays className="h-4 w-4" /> },
    { key: "cabinet", label: "Cabinet / vitrine", shortLabel: "Vitrine", icon: <Images className="h-4 w-4" /> },
    { key: "integrations", label: "Intégrations", shortLabel: "Intégr.", icon: <Link2 className="h-4 w-4" /> },
  ];
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 sm:flex-nowrap">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-4 sm:text-sm ${
            active === t.key
              ? "bg-white text-[#1E3A5F] shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.icon}
          <span className="truncate sm:hidden">{t.shortLabel ?? t.label}</span>
          <span className="hidden truncate sm:inline">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Onglet 1 : Mon profil ────────────────────────────────────────────────────

function TabProfil({
  sophrologue,
  onSaved,
  showToast,
}: {
  sophrologue: Sophrologue;
  onSaved: (s: Sophrologue) => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [form, setForm] = useState({
    prenom: sophrologue.prenom ?? "",
    nom: sophrologue.nom ?? "",
    email: sophrologue.email ?? "",
    telephone: sophrologue.telephone ?? "",
    bio: sophrologue.bio ?? "",
    specialites: (sophrologue.specialites ?? []).join(", "),
    certification_rncp: sophrologue.certification_rncp ?? false,
    siret: sophrologue.siret ?? "",
    lien_teleconsultation: sophrologue.lien_teleconsultation ?? "",
    adresse: sophrologue.adresse ?? "",
    ville: sophrologue.ville ?? "",
    code_postal: sophrologue.code_postal ?? "",
  });
  const [saving, setSaving] = useState(false);

  const publicProfileUrl = getSophrologueProfileUrl(sophrologue);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const result = await uploadAvatarWithSession(supabase, sophrologue.id, file);
      if ("error" in result) {
        showToast(result.error, false);
        return;
      }

      const res = await fetch("/api/sophrologue/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: sophrologue.user_id,
          photo_url: result.publicUrl,
        }),
      });
      const json = (await res.json()) as { error?: string };

      if (!res.ok) {
        showToast(json.error ?? "Impossible d’enregistrer la photo.", false);
        return;
      }

      onSaved({ ...sophrologue, photo_url: result.publicUrl });
      showToast("Photo de profil mise à jour.");
    } catch (err) {
      console.error("[TabProfil] avatar upload:", err);
      showToast("Erreur lors de l’envoi de la photo.", false);
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    console.log("[TabProfil] Bouton Enregistrer cliqué");
    setSaving(true);
    try {
      const payload = {
        userId: sophrologue.user_id, // ← auth user_id (WHERE user_id = ?)
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        phone: form.telephone,
        bio: form.bio,
        specialties: form.specialites
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        certification_rncp: form.certification_rncp,
        siret: form.siret.trim(),
        teleconsultationUrl: form.lien_teleconsultation,
        address: form.adresse,
        city: form.ville,
        postalCode: form.code_postal,
      };

      console.log("[TabProfil] Payload envoyé :", payload);

      const res = await fetch("/api/sophrologue/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      console.log("[TabProfil] Réponse API :", res.status, json);

      if (!res.ok) {
        showToast(json.error ?? "Erreur lors de la sauvegarde.", false);
        return;
      }

      onSaved({
        ...sophrologue,
        ...form,
        specialites: form.specialites.split(",").map((s) => s.trim()).filter(Boolean),
      });
      showToast("Profil mis à jour avec succès.");
    } catch (err) {
      console.error("[TabProfil] Erreur fetch :", err);
      showToast("Erreur réseau lors de la sauvegarde.", false);
    } finally {
      setSaving(false);
    }
  };

  const field = (
    label: string,
    key: Exclude<keyof typeof form, "certification_rncp">,
    opts?: { type?: string; placeholder?: string },
  ) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <Input
        type={opts?.type ?? "text"}
        placeholder={opts?.placeholder}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 pb-6">
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleAvatarChange}
          disabled={avatarUploading}
        />
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={avatarUploading}
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 ring-offset-2 transition hover:ring-2 hover:ring-[#2E75B6]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E75B6] disabled:opacity-60"
          title="Changer la photo de profil"
        >
          {sophrologue.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sophrologue.photo_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-400">
              Photo
            </span>
          )}
          {avatarUploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </span>
          )}
        </button>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-800">Photo de profil</p>
          <p className="text-sm font-semibold text-[#1E3A5F]">
            {[sophrologue.prenom, sophrologue.nom].filter(Boolean).join(" ").trim() ||
              "Votre profil"}
          </p>
          {sophrologue.slug ? (
            <p className="text-xs text-slate-500">Slug : {sophrologue.slug}</p>
          ) : null}
          <p className="text-xs text-slate-500">
            Visible sur votre page publique. JPG, PNG ou WebP — max. 5 Mo.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading}
          >
            {avatarUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi…
              </>
            ) : (
              "Changer la photo"
            )}
          </Button>
        </div>
      </div>

      {publicProfileUrl ? (
        <div>
          <p className="mb-2 text-sm text-[#6B6860]">
            Voici le lien de votre page vitrine publique. Partagez-le avec vos clients
            ou copiez-le pour le diffuser sur vos réseaux.
          </p>
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
            style={{ backgroundColor: "#EAF3DE" }}
          >
            <a
              href={publicProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 items-center gap-1 text-sm font-medium underline"
              style={{ color: "#426F59" }}
              title="Ouvrir la page publique dans un nouvel onglet"
            >
              <span className="truncate">{publicProfileUrl}</span>
              <ExternalLink className="h-4 w-4 shrink-0" />
            </a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(publicProfileUrl);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 1800);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-[#426F59]/30 bg-white px-3 py-1.5 text-xs font-medium text-[#426F59] transition-colors hover:bg-[#f5faee]"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedLink ? "Lien copié" : "Copier le lien"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {field("Prénom", "prenom", { placeholder: "Marie" })}
        {field("Nom", "nom", { placeholder: "Dupont" })}
        {field("Email", "email", { type: "email", placeholder: "marie@exemple.fr" })}
        {field("Téléphone", "telephone", { type: "tel", placeholder: "06 12 34 56 78" })}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">
            Adresse (numéro et rue uniquement)
          </label>
          <Input
            placeholder="Ex : 12 rue de la Paix"
            value={form.adresse}
            onChange={(e) => setForm({ ...form, adresse: e.target.value })}
          />
          <p className="text-xs text-slate-500">
            La ville et le code postal se renseignent séparément ci-dessous.
          </p>
        </div>
        {field("Ville", "ville", { placeholder: "Paris" })}
        {field("Code postal", "code_postal", { placeholder: "75001" })}
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={form.certification_rncp}
              onChange={(e) =>
                setForm({ ...form, certification_rncp: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-[#426F59]"
            />
            Je détiens une certification reconnue RNCP
          </label>
          <p className="text-xs text-slate-500 pl-6">
            Vous pourrez préciser le détail dans vos formations ci-dessous.
          </p>
        </div>
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-slate-600"
            title="Requis si vous facturez en votre nom propre — laissez vide si vous n'en avez pas encore"
          >
            Numéro SIRET (optionnel)
          </label>
          <Input
            value={form.siret}
            onChange={(e) => setForm({ ...form, siret: e.target.value })}
            placeholder="14 chiffres"
          />
          <p className="text-xs text-slate-500">
            Requis si vous facturez en votre nom propre — laissez vide si vous
            n&apos;en avez pas encore. Affiché sur vos factures si renseigné.
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">Bio / Présentation</label>
        <textarea
          rows={4}
          placeholder="Décrivez votre approche, votre parcours…"
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">
          Spécialités{" "}
          <span className="font-normal text-slate-400">(séparées par des virgules)</span>
        </label>
        <Input
          placeholder="Stress, Sommeil, Préparation mentale"
          value={form.specialites}
          onChange={(e) => setForm({ ...form, specialites: e.target.value })}
        />
      </div>

      {field("Lien téléconsultation", "lien_teleconsultation", {
        type: "url",
        placeholder: "https://whereby.com/mon-espace",
      })}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer le profil
        </Button>
      </div>
    </div>
  );
}

// ─── Modal créer / modifier un type de séance ────────────────────────────────

function ModalSeance({
  sophrologueId,
  editing,      // undefined = création, TypeSeance = modification
  onClose,
  onCreated,
  onUpdated,
}: {
  sophrologueId: string;
  editing?: TypeSeance;
  onClose: () => void;
  onCreated: (t: TypeSeance) => void;
  onUpdated: (t: TypeSeance) => void;
}) {
  const isEdit = !!editing;
  const [form, setForm] = useState({
    nom: editing?.nom ?? "",
    duree: editing?.duree_minutes ?? 60,
    tarif: editing ? String(editing.tarif) : "",
    mode: (editing?.mode ?? "presentiel") as ModeSeance,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim() || !form.tarif) {
      setError("Nom et tarif sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && editing) {
        // ── Modification ──────────────────────────────────────────────
        const res = await fetch("/api/types-seances/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editing.id,
            nom: form.nom.trim(),
            duree_minutes: form.duree,
            tarif: parseFloat(form.tarif),
            mode: form.mode,
          }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Erreur."); return; }
        onUpdated({
          ...editing,
          nom: form.nom.trim(),
          duree_minutes: form.duree,
          tarif: parseFloat(form.tarif),
          mode: form.mode,
        });
      } else {
        // ── Création ──────────────────────────────────────────────────
        const res = await fetch("/api/types-seances/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sophrologue_id: sophrologueId,
            nom: form.nom.trim(),
            duree_minutes: form.duree,
            tarif: parseFloat(form.tarif),
            mode: form.mode,
          }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Erreur."); return; }
        onCreated(json.type_seance);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-semibold text-[#1E3A5F]">
            {isEdit ? "Modifier le type de séance" : "Nouveau type de séance"}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              Nom <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Séance individuelle, Découverte…"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Durée</label>
            <select
              value={form.duree}
              onChange={(e) => setForm({ ...form, duree: Number(e.target.value) })}
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
            >
              {DUREES.map((d) => (
                <option key={d} value={d}>{d} minutes</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              Tarif (€) <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min="0"
              step="0.50"
              placeholder="60"
              value={form.tarif}
              onChange={(e) => setForm({ ...form, tarif: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Mode</label>
            <select
              value={form.mode}
              onChange={(e) =>
                setForm({ ...form, mode: e.target.value as ModeSeance })
              }
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/30"
            >
              <option value="presentiel">Présentiel</option>
              <option value="visio">Visio</option>
            </select>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEdit ? (
                "Enregistrer"
              ) : (
                "Ajouter"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Onglet 2 : Types de séances ─────────────────────────────────────────────

function TabSeances({
  sophrologueId,
  showToast,
}: {
  sophrologueId: string;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [types, setTypes] = useState<TypeSeance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  // undefined = modal fermé, null = création, TypeSeance = édition
  const [editingType, setEditingType] = useState<TypeSeance | null | undefined>(undefined);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => {
    supabase
      .from("types_seances")
      .select("id, nom, duree_minutes, tarif, mode, actif")
      .eq("sophrologue_id", sophrologueId)
      .order("nom")
      .returns<TypeSeance[]>()
      .then(({ data }) => {
        setTypes(data ?? []);
        setLoading(false);
      });
  }, [sophrologueId, supabase]);

  const handleToggle = async (t: TypeSeance) => {
    const res = await fetch("/api/types-seances/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, actif: !t.actif }),
    });
    if (res.ok) {
      setTypes((prev) => prev.map((x) => (x.id === t.id ? { ...x, actif: !x.actif } : x)));
    } else {
      showToast("Impossible de modifier le statut.", false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce type de séance ?")) return;
    const res = await fetch("/api/types-seances/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setTypes((prev) => prev.filter((x) => x.id !== id));
      showToast("Type de séance supprimé.");
    } else {
      const json = await res.json();
      showToast(json.error ?? "Erreur lors de la suppression.", false);
    }
  };

  const openCreate = () => { setEditingType(null); setShowModal(true); };
  const openEdit = (t: TypeSeance) => { setEditingType(t); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingType(undefined); };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#2E75B6]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {types.length} type{types.length !== 1 ? "s" : ""} de séance
        </p>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un type de séance
        </Button>
      </div>

      {types.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
          Aucun type de séance configuré.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 sm:grid">
            {["Nom", "Durée", "Tarif", "Statut", "Actions"].map((h) => (
              <span key={h} className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {h}
              </span>
            ))}
          </div>
          <div className="divide-y divide-slate-100">
            {types.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-1 items-center gap-2 px-5 py-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:gap-4"
              >
                <span className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                  {t.nom}
                  {t.mode === "visio" && (
                    <span className="rounded-full bg-[#EAF3DE] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#426F59]">
                      Visio
                    </span>
                  )}
                </span>
                <span className="text-sm text-slate-600">{t.duree_minutes} min</span>
                <span className="text-sm font-medium text-slate-900">{t.tarif.toFixed(2)} €</span>
                <button
                  onClick={() => handleToggle(t)}
                  className={`flex items-center gap-1.5 text-sm font-medium ${
                    t.actif ? "text-[#27AE60]" : "text-slate-400"
                  }`}
                >
                  {t.actif ? (
                    <ToggleRight className="h-5 w-5" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                  {t.actif ? "Actif" : "Inactif"}
                </button>
                {/* Edit + Delete */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(t)}
                    className="text-slate-400 hover:text-[#2E75B6]"
                    title="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-slate-400 hover:text-red-500"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <ModalSeance
          sophrologueId={sophrologueId}
          editing={editingType ?? undefined}
          onClose={closeModal}
          onCreated={(t) => {
            setTypes((prev) => [...prev, t]);
            showToast("Type de séance ajouté.");
          }}
          onUpdated={(t) => {
            setTypes((prev) => prev.map((x) => (x.id === t.id ? t : x)));
            showToast("Type de séance mis à jour.");
          }}
        />
      )}
    </div>
  );
}

// ─── Onglet 3 : Disponibilités (délai de réservation uniquement) ─────────────

function TabDisponibilites({
  sophrologueId,
  showToast,
}: {
  sophrologueId: string;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [delai, setDelai] = useState(24);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => {
    const load = async () => {
      const { data: params } = await supabase
        .from("parametres_cabinet")
        .select("delai_min_reservation_heures")
        .eq("sophrologue_id", sophrologueId)
        .maybeSingle<ParamsCabinet>();

      if (params) setDelai(params.delai_min_reservation_heures);
      setLoading(false);
    };
    void load();
  }, [sophrologueId, supabase]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/sophrologue/disponibilites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sophrologue_id: sophrologueId,
          delai,
          delaiOnly: true,
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        showToast(j.error ?? "Erreur lors de la sauvegarde.", false);
        return;
      }
      showToast("Paramètres de réservation enregistrés.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#2E75B6]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Les <strong>horaires d&apos;ouverture</strong> et les précisions affichées sur votre vitrine se
        configurent dans l&apos;onglet <strong>Cabinet / vitrine</strong>. Ici vous réglez le{" "}
        <strong>délai minimum</strong> entre une réservation et le début de la séance (règle appliquée au
        parcours de réservation en ligne).
      </p>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-5">
        <h3 className="text-sm font-semibold text-slate-800">
          Délai minimum avant réservation
        </h3>
        <select
          value={delai}
          onChange={(e) => setDelai(Number(e.target.value))}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#426F59]/30"
        >
          {DELAIS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          Les clients ne pourront pas réserver moins de{" "}
          {DELAIS.find((d) => d.value === delai)?.label.toLowerCase()} avant la séance.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

function ParametresPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(() => {
    const raw = searchParams.get("tab");
    return isTab(raw) ? raw : "profil";
  });
  const [sophrologue, setSophrologue] = useState<Sophrologue | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast, show: showToast } = useToast();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const refetchSophrologue = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("sophrologues")
      .select(SOPHROLOGUE_SELECT)
      .eq("user_id", user.id)
      .maybeSingle<Sophrologue>();
    if (data) setSophrologue(data);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("sophrologues")
        .select(SOPHROLOGUE_SELECT)
        .eq("user_id", user.id)
        .maybeSingle<Sophrologue>();

      if (!cancelled) {
        setSophrologue(data ?? null);
        setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    const google = searchParams.get("google");
    if (google !== "connected" && google !== "error" && google !== "denied") {
      return;
    }
    if (google === "connected") {
      showToast("Google Agenda connecté.");
    } else if (google === "error") {
      showToast("La connexion à Google Agenda a échoué, réessayez.", false);
    } else {
      showToast("Connexion annulée.", "neutral");
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("google");
    const qs = params.toString();
    router.replace(qs ? `/parametres?${qs}` : "/parametres", { scroll: false });
  }, [searchParams, router, showToast]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#2E75B6]" />
      </main>
    );
  }

  if (!sophrologue) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-500">Profil sophrologue introuvable.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">Paramètres</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gérez votre profil, vos séances, disponibilités et la vitrine de votre cabinet.
          </p>
        </div>

        <TabBar active={tab} onChange={setTab} />

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {tab === "profil" && (
            <TabProfil
              sophrologue={sophrologue}
              onSaved={setSophrologue}
              showToast={showToast}
            />
          )}
          {tab === "seances" && (
            <TabSeances sophrologueId={sophrologue.id} showToast={showToast} />
          )}
          {tab === "disponibilites" && (
            <TabDisponibilites sophrologueId={sophrologue.id} showToast={showToast} />
          )}
          {tab === "cabinet" && (
            <CabinetVitrineTab
              sophrologue={sophrologue}
              supabase={supabase}
              showToast={showToast}
              refetchSophrologue={refetchSophrologue}
            />
          )}
          {tab === "integrations" && (
            <IntegrationsTab showToast={showToast} />
          )}
        </div>
      </div>

      <Toast toast={toast} />
    </main>
  );
}

export default function ParametresPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-[#2E75B6]" />
        </main>
      }
    >
      <ParametresPageInner />
    </Suspense>
  );
}
