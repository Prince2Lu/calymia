"use client";

import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VitrineTagListBlock } from "@/components/cabinet-vitrine/VitrineTagListBlock";
import { HorairesPlagesEditor } from "@/components/cabinet-vitrine/HorairesPlagesEditor";
import {
  emptyHoraires,
  normalizeHoraires,
  type HorairesSophrologue,
} from "@/types/horaires";
import {
  CABINET_ACCEPT_TYPES,
  CABINET_MAX_FILE_BYTES,
  CABINET_MAX_PHOTOS,
  CABINET_PHOTOS_BUCKET,
  cabinetPhotoExtFromMime,
  storageObjectPathFromCabinetPublicUrl,
} from "@/lib/cabinet-photos-storage";

const PAIEMENT_OPTIONS = [
  { id: "cb" as const, label: "Carte bancaire", icon: "💳" },
  { id: "cheque" as const, label: "Chèque", icon: "📝" },
  { id: "especes" as const, label: "Espèces", icon: "💵" },
];

export interface OnboardingVitrineData {
  photos_cabinet: string[];
  horaires: HorairesSophrologue;
  horaires_texte: string;
  infos_pratiques: string;
  modes_paiement: string[];
  formations: string[];
  certifications: string[];
  syndicats: string[];
}

export interface OnboardingVitrineStepProps {
  data: OnboardingVitrineData;
  onChange: (field: keyof OnboardingVitrineData, value: unknown) => void;
  supabase: SupabaseClient;
  userId: string;
  /** Limite photos vitrine selon le plan (défaut : constante storage) */
  maxPhotos?: number;
  /** Erreurs courtes (upload, etc.) — optionnel */
  onError?: (message: string) => void;
}

export function OnboardingVitrineStep({
  data,
  onChange,
  supabase,
  userId,
  maxPhotos = CABINET_MAX_PHOTOS,
  onError,
}: OnboardingVitrineStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const [nf, setNf] = useState("");
  const [nc, setNc] = useState("");
  const [ns, setNs] = useState("");

  const urls = data.photos_cabinet;

  const horairesNorm = normalizeHoraires(data.horaires);

  const setHoraires = (next: HorairesSophrologue) => {
    onChange("horaires", next);
  };

  const togglePaiement = (id: string) => {
    const set = new Set(data.modes_paiement);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange("modes_paiement", Array.from(set));
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (urls.length >= maxPhotos) {
      onError?.(`Maximum ${maxPhotos} photos.`);
      return;
    }
    if (!(CABINET_ACCEPT_TYPES as readonly string[]).includes(file.type)) {
      onError?.("Formats acceptés : JPEG, PNG, WebP.");
      return;
    }
    if (file.size > CABINET_MAX_FILE_BYTES) {
      onError?.("Chaque photo doit faire moins de 5 Mo.");
      return;
    }

    setUploading(true);
    try {
      const ext = cabinetPhotoExtFromMime(file.type);
      const name = `${crypto.randomUUID()}.${ext}`;
      const path = `${userId}/${name}`;

      const { error: upErr } = await supabase.storage
        .from(CABINET_PHOTOS_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (upErr) {
        onError?.(upErr.message || "Échec de l’envoi.");
        return;
      }

      const { data: pub } = supabase.storage.from(CABINET_PHOTOS_BUCKET).getPublicUrl(path);
      onChange("photos_cabinet", [...urls, pub.publicUrl]);
    } catch {
      onError?.("Erreur lors de l’upload.");
    } finally {
      setUploading(false);
    }
  };

  const removePhotoAt = async (index: number) => {
    const url = urls[index];
    const objectPath = storageObjectPathFromCabinetPublicUrl(url, supabaseUrl);
    const next = urls.filter((_, i) => i !== index);

    if (objectPath) {
      const { error: delErr } = await supabase.storage
        .from(CABINET_PHOTOS_BUCKET)
        .remove([objectPath]);
      if (delErr) {
        onError?.(delErr.message || "Suppression fichier impossible.");
      }
    }
    onChange("photos_cabinet", next);
  };

  const addFormation = () => {
    const t = nf.trim();
    if (!t) return;
    onChange("formations", [...data.formations, t]);
    setNf("");
  };
  const addCert = () => {
    const t = nc.trim();
    if (!t) return;
    onChange("certifications", [...data.certifications, t]);
    setNc("");
  };
  const addSyn = () => {
    const t = ns.trim();
    if (!t) return;
    onChange("syndicats", [...data.syndicats, t]);
    setNs("");
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-2xl" aria-hidden>
          🖼️
        </p>
        <h2 className="text-xl font-semibold text-[#426F59]">Votre vitrine</h2>
        <p className="text-sm text-slate-600">
          Complétez votre profil public pour attirer plus de clients. Tous ces champs sont optionnels
          et modifiables à tout moment dans vos Paramètres.
        </p>
      </header>

      {/* A — Photos */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-slate-800">Photos du cabinet</h3>
        <p className="text-sm text-slate-500">
          Jusqu’à {maxPhotos} photos (JPEG, PNG, WebP, max 5 Mo).
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {urls.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative aspect-square w-full max-w-[120px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => void removePhotoAt(i)}
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
            accept="image/*"
            className="hidden"
            onChange={(ev) => void handleFile(ev)}
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
        </div>
      </section>

      <hr className="border-slate-200" />

      {/* B — Horaires */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-slate-800">Horaires d&apos;ouverture</h3>
        <HorairesPlagesEditor horaires={horairesNorm} onChange={setHoraires} />
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Précisions (optionnel)</label>
          <textarea
            value={data.horaires_texte}
            onChange={(e) => onChange("horaires_texte", e.target.value)}
            rows={3}
            placeholder="Ex : Sur rendez-vous uniquement, disponible le soir sur demande..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#426F59]/30"
          />
        </div>
      </section>

      <hr className="border-slate-200" />

      {/* C — Infos pratiques */}
      <section className="space-y-2">
        <h3 className="text-base font-semibold text-slate-800">Informations pratiques</h3>
        <textarea
          value={data.infos_pratiques}
          onChange={(e) => onChange("infos_pratiques", e.target.value)}
          rows={4}
          placeholder="Ex : Cabinet au 2ème étage, parking gratuit à 50m, accessible PMR..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#426F59]/30"
        />
      </section>

      <hr className="border-slate-200" />

      {/* D — Paiement */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">Modes de paiement acceptés</h3>
        <div className="space-y-3">
          {PAIEMENT_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={data.modes_paiement.includes(opt.id)}
                onChange={() => togglePaiement(opt.id)}
                className="h-4 w-4 rounded border-slate-300 text-[#426F59] focus:ring-[#426F59]"
              />
              <span className="text-lg" aria-hidden>
                {opt.icon}
              </span>
              <span className="text-sm font-medium text-slate-800">{opt.label}</span>
            </label>
          ))}
        </div>
      </section>

      <hr className="border-slate-200" />

      {/* E — Tags */}
      <section className="space-y-8">
        <h3 className="text-base font-semibold text-slate-800">
          Formations, certifications & syndicats
        </h3>
        <VitrineTagListBlock
          title="Formations"
          placeholder="Ex : DU Sophrologie - Université Paris V"
          items={data.formations}
          onItemsChange={(items) => onChange("formations", items)}
          newItem={nf}
          onNewItemChange={setNf}
          onAdd={addFormation}
        />
        <VitrineTagListBlock
          title="Certifications"
          placeholder="Ex : Certifié RNCP Niveau 5"
          items={data.certifications}
          onItemsChange={(items) => onChange("certifications", items)}
          newItem={nc}
          onNewItemChange={setNc}
          onAdd={addCert}
        />
        <VitrineTagListBlock
          title="Syndicats / Associations professionnelles"
          placeholder="Ex : Chambre Syndicale de la Sophrologie"
          items={data.syndicats}
          onItemsChange={(items) => onChange("syndicats", items)}
          newItem={ns}
          onNewItemChange={setNs}
          onAdd={addSyn}
        />
      </section>
    </div>
  );
}

export function createInitialVitrineData(): OnboardingVitrineData {
  return {
    photos_cabinet: [],
    horaires: emptyHoraires(),
    horaires_texte: "",
    infos_pratiques: "",
    modes_paiement: [],
    formations: [],
    certifications: [],
    syndicats: [],
  };
}
