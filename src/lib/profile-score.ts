import type { SupabaseClient } from "@supabase/supabase-js";
import { hasHorairesContenu, normalizeHoraires } from "@/lib/horaires";

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
  /** Points attribués si complété (défaut 10). Le max est PROFILE_SCORE_MAX. */
  points?: number;
};

type ProfileScoreCriterion = Omit<ProfileScoreItem, "completed">;

const DEFAULT_CRITERION_POINTS = 10;

function criterionPoints(item: { points?: number }): number {
  return item.points ?? DEFAULT_CRITERION_POINTS;
}

/** Barème statique (sans `completed`) — source unique des poids. */
const PROFILE_SCORE_CRITERIA: ProfileScoreCriterion[] = [
  {
    key: "photo",
    label: "Photo de profil",
    shortLabel: "une photo de profil",
    sublabel: "Fort impact SEO et conversion",
    impact: "SEO",
    href: "/parametres?tab=profil",
  },
  {
    key: "bio",
    label: "Bio / description",
    shortLabel: "une bio",
    sublabel: "Fort impact sur votre référencement Google",
    impact: "SEO",
    href: "/parametres?tab=profil",
  },
  {
    key: "specialites",
    label: "Spécialités",
    shortLabel: "vos spécialités",
    sublabel: "Améliorent votre indexation Google",
    impact: "SEO",
    href: "/parametres?tab=profil",
  },
  {
    key: "tarifs",
    label: "Tarifs (types de séance)",
    shortLabel: "au moins un type de séance",
    sublabel: "Indispensable pour la réservation en ligne",
    impact: "Conversion",
    href: "/parametres?tab=seances",
  },
  {
    key: "horaires",
    label: "Horaires",
    shortLabel: "vos horaires",
    sublabel:
      "Apparaissent sur votre page publique et permettent la réservation en ligne",
    impact: "Conversion",
    href: "/parametres?tab=cabinet",
    // Fusion ex-critères « disponibilites » + « horaires » → 20 pts
    points: 20,
  },
  {
    key: "photos_cabinet",
    label: "Photos cabinet",
    shortLabel: "des photos de votre cabinet",
    sublabel: "Augmentent le taux de réservation",
    impact: "Conversion",
    href: "/parametres?tab=cabinet",
  },
  {
    key: "formations",
    label: "Formations & certifications",
    shortLabel: "vos formations",
    sublabel: "Renforcent la confiance des clients",
    impact: "Confiance",
    href: "/parametres?tab=cabinet",
  },
  {
    key: "syndicats",
    label: "Syndicats",
    shortLabel: "votre appartenance syndicale",
    sublabel: "Renforcent la confiance des clients",
    impact: "Confiance",
    href: "/parametres?tab=cabinet",
  },
];

/** Somme des poids du barème actuel (aujourd’hui 90). Ne pas coder en dur. */
export const PROFILE_SCORE_MAX = PROFILE_SCORE_CRITERIA.reduce(
  (sum, item) => sum + criterionPoints(item),
  0,
);

function isNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

export async function computeProfileScore(
  sophrologue: SophrologueRow,
  supabaseServer: SupabaseServerClient,
): Promise<{ score: number; items: ProfileScoreItem[] }> {
  const { data: tarifsRows } = await supabaseServer
    .from("types_seances")
    .select("id")
    .eq("sophrologue_id", sophrologue.id)
    .eq("actif", true)
    .limit(1);

  const hasTarifs = (tarifsRows?.length ?? 0) > 0;
  const hasHoraires = hasHorairesContenu(normalizeHoraires(sophrologue.horaires));

  const completedByKey: Record<string, boolean> = {
    photo: sophrologue.photo_url != null && sophrologue.photo_url !== "",
    bio: sophrologue.bio != null && sophrologue.bio.trim().length > 50,
    specialites: isNonEmptyArray(sophrologue.specialites),
    tarifs: hasTarifs,
    horaires: hasHoraires,
    photos_cabinet: isNonEmptyArray(sophrologue.photos_cabinet),
    formations: isNonEmptyArray(sophrologue.formations),
    syndicats: isNonEmptyArray(sophrologue.syndicats),
  };

  const items: ProfileScoreItem[] = PROFILE_SCORE_CRITERIA.map((criterion) => ({
    ...criterion,
    completed: completedByKey[criterion.key] ?? false,
  }));

  const score = items.reduce(
    (sum, item) => sum + (item.completed ? criterionPoints(item) : 0),
    0,
  );

  const ordered = [
    ...items.filter((item) => !item.completed),
    ...items.filter((item) => item.completed),
  ];

  return { score, items: ordered };
}
