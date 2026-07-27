/**
 * Horaires vitrine + créneaux réservables — source de vérité : `sophrologues.horaires` (JSONB).
 * La table `disponibilites` n’est plus lue pour le booking (repli d’affichage legacy uniquement).
 */
export {
  emptyHoraires,
  normalizeHoraires,
  JOURS_LABELS,
  JOURS_SEMAINE,
  type HorairesSophrologue,
  type JourSemaine,
  type PlageHoraire,
} from "@/types/horaires";

import {
  emptyHoraires,
  normalizeHoraires,
  JOURS_SEMAINE,
  type HorairesSophrologue,
  type JourSemaine,
} from "@/types/horaires";

export type DispoHoraireRow = {
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
  actif?: boolean | null;
};

/** Plage horaire au format attendu par `dispoWindowParisDay` / `buildSlotsFromDispo`. */
export type DispoWindow = { heure_debut: string; heure_fin: string };

/** Au moins une plage renseignée (après normalisation). */
export function hasHorairesContenu(h: HorairesSophrologue): boolean {
  return JOURS_SEMAINE.some((j) => (h[j] ?? []).length > 0);
}

/**
 * Convertit le JSONB horaires (normalisé) en Map<jsDay, DispoWindow[]>,
 * alignée sur la convention JS getDay() (0=dimanche…6=samedi),
 * pour réutilisation directe par buildSlotsFromDispo() côté tunnel et compute-next-slot.
 */
export function dispoByJsDayFromHoraires(
  horaires: HorairesSophrologue,
): Map<number, DispoWindow[]> {
  const map = new Map<number, DispoWindow[]>();
  JOURS_SEMAINE.forEach((jour, index) => {
    const jsDay = (index + 1) % 7; // lundi(0)->1, ..., dimanche(6)->0
    const plages = horaires[jour] ?? [];
    if (plages.length === 0) return;
    map.set(
      jsDay,
      plages.map((p) => ({ heure_debut: p.debut, heure_fin: p.fin })),
    );
  });
  return map;
}

function formatHeureDb(heure: string): string {
  const t = heure.trim();
  if (t.length >= 5) return t.slice(0, 5);
  return t;
}

/**
 * Mappe `jour_semaine` BDD → clé française.
 * - 0–6 : convention réservation (0 = lundi … 6 = dimanche)
 * - 1–6 : convention onboarding legacy (1 = lundi … 6 = samedi)
 */
function jourSemaineFromDb(jour: number): JourSemaine | null {
  if (jour >= 0 && jour <= 6) {
    return JOURS_SEMAINE[jour] ?? null;
  }
  if (jour >= 1 && jour <= 6) {
    return JOURS_SEMAINE[jour - 1] ?? null;
  }
  return null;
}

/** Construit les horaires vitrine à partir des plages `disponibilites`. */
export function horairesFromDisponibilites(
  rows: DispoHoraireRow[],
): HorairesSophrologue {
  const result = emptyHoraires();
  for (const row of rows) {
    if (row.actif === false) continue;
    const jour = jourSemaineFromDb(row.jour_semaine);
    if (!jour) continue;
    const debut = formatHeureDb(row.heure_debut);
    const fin = formatHeureDb(row.heure_fin);
    if (!debut || !fin) continue;
    result[jour] = [...(result[jour] ?? []), { debut, fin }];
  }
  return result;
}

/**
 * Horaires affichés sur la page publique : JSONB `sophrologues.horaires`.
 * Repli legacy sur `disponibilites` uniquement si le JSONB est vide (comptes anciens).
 */
export function resolvePublicHoraires(
  horairesRaw: unknown,
  disponibilites: DispoHoraireRow[] | null | undefined,
): HorairesSophrologue {
  const fromJson = normalizeHoraires(horairesRaw);
  if (hasHorairesContenu(fromJson)) {
    return fromJson;
  }
  return horairesFromDisponibilites(disponibilites ?? []);
}
