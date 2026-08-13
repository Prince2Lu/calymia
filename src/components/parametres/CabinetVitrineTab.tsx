"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2, Mail, Phone, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VitrineTagListBlock } from "@/components/cabinet-vitrine/VitrineTagListBlock";
import {
  CABINET_ACCEPT_TYPES,
  CABINET_MAX_FILE_BYTES,
  CABINET_PHOTOS_BUCKET,
  cabinetPhotoExtFromMime,
  storageObjectPathFromCabinetPublicUrl,
} from "@/lib/cabinet-photos-storage";
import { usePlan } from "@/hooks/usePlan";
import { HorairesPlagesEditor } from "@/components/cabinet-vitrine/HorairesPlagesEditor";
import {
  normalizeHoraires,
  type HorairesSophrologue,
} from "@/types/horaires";

/** @deprecated Utiliser `JOURS_SEMAINE` depuis `@/types/horaires` */
export { JOURS_SEMAINE as JOUR_KEYS, JOURS_LABELS } from "@/types/horaires";
export type { JourSemaine as JourKey } from "@/types/horaires";

const BUCKET = CABINET_PHOTOS_BUCKET;
const MAX_FILE_BYTES = CABINET_MAX_FILE_BYTES;
const ACCEPT_TYPES = [...CABINET_ACCEPT_TYPES];

async function patchSophrologue(
  userId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/sophrologue/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...patch }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: json.error ?? "Erreur serveur." };
  }
  return { ok: true };
}

// ─── Photos ────────────────────────────────────────────────────────────────

function PhotosCabinetSection({
  userId,
  supabase,
  urls,
  maxPhotos,
  showToast,
  refetch,
}: {
  userId: string;
  supabase: SupabaseClient;
  urls: string[];
  maxPhotos: number;
  showToast: (msg: string, ok?: boolean) => void;
  refetch: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const persistUrls = async (next: string[]) => {
    const r = await patchSophrologue(userId, { photos_cabinet: next });
    if (!r.ok) {
      showToast(r.error ?? "Erreur lors de la sauvegarde", false);
      return false;
    }
    return true;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (urls.length >= maxPhotos) {
      showToast(`Maximum ${maxPhotos} photos.`, false);
      return;
    }
    if (!(CABINET_ACCEPT_TYPES as readonly string[]).includes(file.type)) {
      showToast("Formats acceptés : JPEG, PNG, WebP.", false);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      showToast("Chaque photo doit faire moins de 5 Mo.", false);
      return;
    }

    setUploading(true);
    try {
      const ext = cabinetPhotoExtFromMime(file.type);
      const name = `${crypto.randomUUID()}.${ext}`;
      const path = `${userId}/${name}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (upErr) {
        showToast(upErr.message || "Échec de l’envoi.", false);
        return;
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      const next = [...urls, publicUrl];
    const ok = await persistUrls(next);
    if (ok) {
      await refetch();
      showToast("Photo ajoutée ✓");
    }
    } catch {
      showToast("Erreur lors de l’upload.", false);
    } finally {
      setUploading(false);
    }
  };

  const removeAt = async (index: number) => {
    const url = urls[index];
    const objectPath = storageObjectPathFromCabinetPublicUrl(url, supabaseUrl);
    const next = urls.filter((_, i) => i !== index);

    if (objectPath) {
      const { error: delErr } = await supabase.storage
        .from(BUCKET)
        .remove([objectPath]);
      if (delErr) {
        showToast(delErr.message || "Suppression fichier impossible.", false);
      }
    }

    const ok = await persistUrls(next);
    if (ok) {
      await refetch();
      showToast("Photo supprimée ✓");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#1E3A5F]">Photos du cabinet</h2>
        <p className="mt-1 text-sm text-slate-500">
          Jusqu’à {maxPhotos} photos affichées sur votre vitrine (JPEG, PNG, WebP, max 5 Mo).
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {urls.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative aspect-square w-full max-w-[120px] overflow-hidden rounded-lg border border-[#d1d5db] bg-slate-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => void removeAt(i)}
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Supprimer la photo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_TYPES.join(",")}
          className="hidden"
          onChange={(e) => void handleFile(e)}
        />
        <Button
          type="button"
          variant="outline"
          className="border-[#426F59] text-[#426F59] hover:bg-[#F0F7F4]"
          disabled={urls.length >= maxPhotos || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Envoi…
            </>
          ) : (
            "Ajouter une photo"
          )}
        </Button>
        {urls.length >= maxPhotos && (
          <p className="mt-2 text-xs text-amber-700">Nombre maximum de photos atteint.</p>
        )}
      </div>
    </div>
  );
}

// ─── Horaires ────────────────────────────────────────────────────────────────

function HorairesCabinetSection({
  userId,
  initialHoraires,
  initialTexte,
  showToast,
  refetch,
}: {
  userId: string;
  initialHoraires: unknown;
  initialTexte: string | null;
  showToast: (msg: string, ok?: boolean) => void;
  refetch: () => Promise<void>;
}) {
  const [horaires, setHoraires] = useState<HorairesSophrologue>(() =>
    normalizeHoraires(initialHoraires),
  );
  const [texte, setTexte] = useState(initialTexte ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHoraires(normalizeHoraires(initialHoraires));
    setTexte(initialTexte ?? "");
  }, [initialHoraires, initialTexte]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await patchSophrologue(userId, {
        horaires,
        horaires_texte: texte,
      });
      if (!r.ok) {
        showToast(r.error ?? "Erreur lors de la sauvegarde", false);
        return;
      }
      await refetch();
      showToast("Modifications enregistrées ✓");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-[#1E3A5F]">Horaires d&apos;ouverture</h2>

      <HorairesPlagesEditor horaires={horaires} onChange={setHoraires} />

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          Précisions sur vos disponibilités (optionnel)
        </label>
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={3}
          placeholder="Ex : Sur rendez-vous uniquement, disponible le soir sur demande..."
          className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#426F59]/30"
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="gap-2 bg-[#426F59] hover:bg-[#355a49]"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer les horaires
        </Button>
      </div>
    </div>
  );
}

// ─── Infos pratiques ─────────────────────────────────────────────────────────

function InfosPratiquesSection({
  userId,
  initial,
  showToast,
  refetch,
}: {
  userId: string;
  initial: string | null;
  showToast: (msg: string, ok?: boolean) => void;
  refetch: () => Promise<void>;
}) {
  const [text, setText] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(initial ?? "");
  }, [initial]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await patchSophrologue(userId, { infos_pratiques: text });
      if (!r.ok) {
        showToast(r.error ?? "Erreur lors de la sauvegarde", false);
        return;
      }
      await refetch();
      showToast("Modifications enregistrées ✓");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-[#1E3A5F]">Informations pratiques</h2>
      <label className="block text-sm font-medium text-slate-700">
        Accès et informations pratiques
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Ex : Cabinet au 2ème étage (ascenseur disponible), parking gratuit à 50m, accessible PMR, sonnette interphone..."
        className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#426F59]/30"
      />
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="gap-2 bg-[#426F59] hover:bg-[#355a49]"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

// ─── Modes de paiement ───────────────────────────────────────────────────────

const PAIEMENT_OPTIONS = [
  { id: "cb" as const, label: "Carte bancaire", icon: "💳" },
  { id: "cheque" as const, label: "Chèque", icon: "📝" },
  { id: "especes" as const, label: "Espèces", icon: "💵" },
];

function ModesPaiementSection({
  userId,
  initial,
  showToast,
  refetch,
}: {
  userId: string;
  initial: string[] | null;
  showToast: (msg: string, ok?: boolean) => void;
  refetch: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initial ?? []),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(new Set(initial ?? []));
  }, [initial]);

  const toggle = async (id: string) => {
    const snapshot = new Set(selected);
    const next = new Set(snapshot);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);

    setSaving(true);
    try {
      const r = await patchSophrologue(userId, {
        modes_paiement: Array.from(next),
      });
      if (!r.ok) {
        showToast(r.error ?? "Erreur lors de la sauvegarde", false);
        setSelected(snapshot);
        return;
      }
      await refetch();
      showToast("Modifications enregistrées ✓");
    } catch {
      showToast("Erreur lors de la sauvegarde", false);
      setSelected(snapshot);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-[#1E3A5F]">Modes de paiement acceptés</h2>
      <div className="space-y-3">
        {PAIEMENT_OPTIONS.map((opt) => (
          <label
            key={opt.id}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border border-[#d1d5db] p-3 transition-colors hover:bg-slate-50 ${saving ? "opacity-60 pointer-events-none" : ""}`}
          >
            <input
              type="checkbox"
              checked={selected.has(opt.id)}
              onChange={() => void toggle(opt.id)}
              className="h-4 w-4 rounded border-[#d1d5db] text-[#426F59] focus:ring-[#426F59]"
            />
            <span className="text-lg" aria-hidden>
              {opt.icon}
            </span>
            <span className="text-sm font-medium text-slate-800">{opt.label}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        ℹ️ Les modes de paiement acceptés sont affichés sur votre page publique.
      </p>
    </div>
  );
}

function CoordonneesPubliquesSection({
  userId,
  email,
  telephone,
  initialAfficherEmail,
  initialAfficherTelephone,
  showToast,
  refetch,
}: {
  userId: string;
  email: string | null;
  telephone: string | null;
  initialAfficherEmail: boolean;
  initialAfficherTelephone: boolean;
  showToast: (msg: string, ok?: boolean) => void;
  refetch: () => Promise<void>;
}) {
  const [afficherEmail, setAfficherEmail] = useState(initialAfficherEmail);
  const [afficherTelephone, setAfficherTelephone] = useState(
    initialAfficherTelephone,
  );
  const [saving, setSaving] = useState(false);

  const emailTrim = email?.trim() ?? "";
  const telephoneTrim = telephone?.trim() ?? "";
  const hasTelephone = telephoneTrim.length > 0;

  useEffect(() => {
    setAfficherEmail(initialAfficherEmail);
    setAfficherTelephone(initialAfficherTelephone);
  }, [initialAfficherEmail, initialAfficherTelephone]);

  const toggle = async (
    field: "afficher_email" | "afficher_telephone",
    next: boolean,
  ) => {
    if (field === "afficher_telephone" && !hasTelephone) return;

    const snapshotEmail = afficherEmail;
    const snapshotTel = afficherTelephone;
    if (field === "afficher_email") setAfficherEmail(next);
    else setAfficherTelephone(next);

    setSaving(true);
    try {
      const r = await patchSophrologue(userId, { [field]: next });
      if (!r.ok) {
        showToast(r.error ?? "Erreur lors de la sauvegarde", false);
        setAfficherEmail(snapshotEmail);
        setAfficherTelephone(snapshotTel);
        return;
      }
      await refetch();
      showToast("Modifications enregistrées ✓");
    } catch {
      showToast("Erreur lors de la sauvegarde", false);
      setAfficherEmail(snapshotEmail);
      setAfficherTelephone(snapshotTel);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-[#1E3A5F]">Coordonnées publiques</h2>
      <div className="space-y-3">
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-lg border border-[#d1d5db] p-3 transition-colors hover:bg-slate-50 ${saving ? "opacity-60 pointer-events-none" : ""}`}
        >
          <input
            type="checkbox"
            checked={afficherEmail}
            onChange={(e) => void toggle("afficher_email", e.target.checked)}
            className="h-4 w-4 rounded border-[#d1d5db] text-[#426F59] focus:ring-[#426F59]"
          />
          <Mail className="h-4 w-4 shrink-0 text-[#426F59]" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-800">
              Afficher mon email
            </span>
            <span className="block text-xs text-slate-500">
              {emailTrim || "—"}
            </span>
          </span>
        </label>
        <label
          className={`flex items-center gap-3 rounded-lg border border-[#d1d5db] p-3 transition-colors ${
            hasTelephone
              ? `cursor-pointer hover:bg-slate-50 ${saving ? "opacity-60 pointer-events-none" : ""}`
              : "cursor-not-allowed opacity-60"
          }`}
        >
          <input
            type="checkbox"
            checked={hasTelephone && afficherTelephone}
            disabled={!hasTelephone}
            onChange={(e) =>
              void toggle("afficher_telephone", e.target.checked)
            }
            className="h-4 w-4 rounded border-[#d1d5db] text-[#426F59] focus:ring-[#426F59] disabled:cursor-not-allowed"
          />
          <Phone className="h-4 w-4 shrink-0 text-[#426F59]" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-800">
              Afficher mon téléphone
            </span>
            <span className="block text-xs text-slate-500">
              {hasTelephone
                ? telephoneTrim
                : "Renseignez d'abord votre téléphone dans Paramètres → Mon profil"}
            </span>
          </span>
        </label>
      </div>
      <p className="text-xs text-slate-500">
        ℹ️ L&apos;email et le téléphone sont affichés sur votre page publique
        uniquement si vous cochez les cases correspondantes.
      </p>
    </div>
  );
}

function FormationsCertificationsSection({
  userId,
  initialFormations,
  initialCertifs,
  initialSyndicats,
  showToast,
  refetch,
}: {
  userId: string;
  initialFormations: string[] | null;
  initialCertifs: string[] | null;
  initialSyndicats: string[] | null;
  showToast: (msg: string, ok?: boolean) => void;
  refetch: () => Promise<void>;
}) {
  const [formations, setFormations] = useState<string[]>(initialFormations ?? []);
  const [certifications, setCertifications] = useState<string[]>(
    initialCertifs ?? [],
  );
  const [syndicats, setSyndicats] = useState<string[]>(initialSyndicats ?? []);
  const [nf, setNf] = useState("");
  const [nc, setNc] = useState("");
  const [ns, setNs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormations(initialFormations ?? []);
    setCertifications(initialCertifs ?? []);
    setSyndicats(initialSyndicats ?? []);
  }, [initialFormations, initialCertifs, initialSyndicats]);

  const addFormation = () => {
    const t = nf.trim();
    if (!t) return;
    setFormations((prev) => [...prev, t]);
    setNf("");
  };
  const addCert = () => {
    const t = nc.trim();
    if (!t) return;
    setCertifications((prev) => [...prev, t]);
    setNc("");
  };
  const addSyn = () => {
    const t = ns.trim();
    if (!t) return;
    setSyndicats((prev) => [...prev, t]);
    setNs("");
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await patchSophrologue(userId, {
        formations,
        certifications,
        syndicats,
      });
      if (!r.ok) {
        showToast(r.error ?? "Erreur lors de la sauvegarde", false);
        return;
      }
      await refetch();
      showToast("Modifications enregistrées ✓");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-8">
      <h2 className="text-lg font-semibold text-[#1E3A5F]">
        Formations, certifications & syndicats
      </h2>

      <VitrineTagListBlock
        title="Formations"
        placeholder="Ex : DU Sophrologie - Université Paris V"
        items={formations}
        onItemsChange={setFormations}
        newItem={nf}
        onNewItemChange={setNf}
        onAdd={addFormation}
      />
      <VitrineTagListBlock
        title="Certifications"
        placeholder="Ex : Certifié RNCP Niveau 5"
        items={certifications}
        onItemsChange={setCertifications}
        newItem={nc}
        onNewItemChange={setNc}
        onAdd={addCert}
      />
      <VitrineTagListBlock
        title="Syndicats / Associations professionnelles"
        placeholder="Ex : Chambre Syndicale de la Sophrologie"
        items={syndicats}
        onItemsChange={setSyndicats}
        newItem={ns}
        onNewItemChange={setNs}
        onAdd={addSyn}
      />

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="gap-2 bg-[#426F59] hover:bg-[#355a49]"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer formations & certifications
        </Button>
      </div>
    </div>
  );
}

// ─── Tab export ──────────────────────────────────────────────────────────────

export type CabinetSophrologueFields = {
  user_id: string;
  email: string | null;
  telephone: string | null;
  afficher_email: boolean;
  afficher_telephone: boolean;
  photos_cabinet: string[] | null;
  horaires: unknown;
  horaires_texte: string | null;
  infos_pratiques: string | null;
  modes_paiement: string[] | null;
  formations: string[] | null;
  certifications: string[] | null;
  syndicats: string[] | null;
};

export function CabinetVitrineTab({
  sophrologue,
  showToast,
  supabase,
  refetchSophrologue,
}: {
  sophrologue: CabinetSophrologueFields;
  showToast: (msg: string, ok?: boolean) => void;
  supabase: SupabaseClient;
  refetchSophrologue: () => Promise<void>;
}) {
  const { maxPhotos } = usePlan();
  const urls = sophrologue.photos_cabinet ?? [];

  return (
    <div className="space-y-6">
      <PhotosCabinetSection
        userId={sophrologue.user_id}
        supabase={supabase}
        urls={urls}
        maxPhotos={maxPhotos}
        showToast={showToast}
        refetch={refetchSophrologue}
      />
      <HorairesCabinetSection
        userId={sophrologue.user_id}
        initialHoraires={sophrologue.horaires}
        initialTexte={sophrologue.horaires_texte}
        showToast={showToast}
        refetch={refetchSophrologue}
      />
      <InfosPratiquesSection
        userId={sophrologue.user_id}
        initial={sophrologue.infos_pratiques}
        showToast={showToast}
        refetch={refetchSophrologue}
      />
      <ModesPaiementSection
        userId={sophrologue.user_id}
        initial={sophrologue.modes_paiement}
        showToast={showToast}
        refetch={refetchSophrologue}
      />
      <CoordonneesPubliquesSection
        userId={sophrologue.user_id}
        email={sophrologue.email}
        telephone={sophrologue.telephone}
        initialAfficherEmail={sophrologue.afficher_email ?? false}
        initialAfficherTelephone={sophrologue.afficher_telephone ?? false}
        showToast={showToast}
        refetch={refetchSophrologue}
      />
      <FormationsCertificationsSection
        userId={sophrologue.user_id}
        initialFormations={sophrologue.formations}
        initialCertifs={sophrologue.certifications}
        initialSyndicats={sophrologue.syndicats}
        showToast={showToast}
        refetch={refetchSophrologue}
      />
    </div>
  );
}
