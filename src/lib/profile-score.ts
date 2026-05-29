import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Le projet n'expose pas (encore) de type partagé pour la table `sophrologues`.
 * On définit ici la forme structurelle minimale requise par le calcul de score.
 * Tout objet ligne `sophrologues` plus complet est compatible.
 */
export type SophrologueRow = {
  id: string;
  photo_url: string | null;
  bio: string | null;
  specialites: string[] | null;
  horaires: unknown;
  photos_cabinet: string[] | null;
  formations: string[] | null;
  numero_rpps: string | null;
  syndicats: string[] | null;
};

export type SupabaseServerClient = SupabaseClient;

export type ProfileImpact = "SEO" | "Conversion" | "Confiance";

export type ProfileScoreItem = {
  key: string;
  label: string;
  shortLabel: string;
  sublabel: string;
  impact: ProfileImpact;
  completed: boolean;
  href: string;
};

function isNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

export async function computeProfileScore(
  sophrologue: SophrologueRow,
  supabaseServer: SupabaseServerClient,
): Promise<{ score: number; items: ProfileScoreItem[] }> {
  const [tarifsRes, disponibilitesRes] = await Promise.all([
    supabaseServer
      .from("types_seances")
      .select("id")
      .eq("sophrologue_id", sophrologue.id)
      .eq("actif", true)
      .limit(1),
    supabaseServer
      .from("disponibilites")
      .select("id")
      .eq("sophrologue_id", sophrologue.id)
      .limit(1),
  ]);

  const hasTarifs = (tarifsRes.data?.length ?? 0) > 0;
  const hasDisponibilites = (disponibilitesRes.data?.length ?? 0) > 0;

  const items: ProfileScoreItem[] = [
    {
      key: "photo",
      label: "Photo de profil",
      shortLabel: "une photo de profil",
      sublabel: "Fort impact SEO et conversion",
      impact: "SEO",
      completed: sophrologue.photo_url != null && sophrologue.photo_url !== "",
      href: "/dashboard/parametres?tab=profil",
    },
    {
      key: "bio",
      label: "Bio / description",
      shortLabel: "une bio",
      sublabel: "Fort impact sur votre référencement Google",
      impact: "SEO",
      completed: sophrologue.bio != null && sophrologue.bio.trim().length > 50,
      href: "/dashboard/parametres?tab=profil",
    },
    {
      key: "specialites",
      label: "Spécialités",
      shortLabel: "vos spécialités",
      sublabel: "Améliorent votre indexation Google",
      impact: "SEO",
      completed: isNonEmptyArray(sophrologue.specialites),
      href: "/dashboard/parametres?tab=profil",
    },
    {
      key: "tarifs",
      label: "Tarifs (types de séance)",
      shortLabel: "au moins un type de séance",
      sublabel: "Indispensable pour la réservation en ligne",
      impact: "Conversion",
      completed: hasTarifs,
      href: "/dashboard/parametres?tab=seances",
    },
    {
      key: "disponibilites",
      label: "Disponibilités",
      shortLabel: "des créneaux de disponibilité",
      sublabel: "Permettent aux clients de réserver en ligne",
      impact: "Conversion",
      completed: hasDisponibilites,
      href: "/dashboard/parametres?tab=disponibilites",
    },
    {
      key: "horaires",
      label: "Horaires vitrine",
      shortLabel: "vos horaires vitrine",
      sublabel: "Apparaissent sur votre page publique",
      impact: "SEO",
      completed: sophrologue.horaires != null,
      href: "/dashboard/parametres?tab=vitrine",
    },
    {
      key: "photos_cabinet",
      label: "Photos cabinet",
      shortLabel: "des photos de votre cabinet",
      sublabel: "Augmentent le taux de réservation",
      impact: "Conversion",
      completed: isNonEmptyArray(sophrologue.photos_cabinet),
      href: "/dashboard/parametres?tab=vitrine",
    },
    {
      key: "formations",
      label: "Formations & certifications",
      shortLabel: "vos formations",
      sublabel: "Renforcent la confiance des clients",
      impact: "Confiance",
      completed: isNonEmptyArray(sophrologue.formations),
      href: "/dashboard/parametres?tab=vitrine",
    },
    {
      key: "rpps",
      label: "Numéro RPPS",
      shortLabel: "votre numéro RPPS",
      sublabel: "Gage de sérieux professionnel",
      impact: "Confiance",
      completed: sophrologue.numero_rpps != null && sophrologue.numero_rpps !== "",
      href: "/dashboard/parametres?tab=profil",
    },
    {
      key: "syndicats",
      label: "Syndicats",
      shortLabel: "votre appartenance syndicale",
      sublabel: "Renforcent la confiance des clients",
      impact: "Confiance",
      completed: isNonEmptyArray(sophrologue.syndicats),
      href: "/dashboard/parametres?tab=vitrine",
    },
  ];

  const score = items.filter((item) => item.completed).length * 10;

  const ordered = [
    ...items.filter((item) => !item.completed),
    ...items.filter((item) => item.completed),
  ];

  return { score, items: ordered };
}
