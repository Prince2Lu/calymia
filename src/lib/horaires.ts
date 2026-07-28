/**
 * Horaires vitrine + créneaux réservables — source de vérité : `sophrologues.horaires` (JSONB).
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

import { JOURS_SEMAINE, type HorairesSophrologue } from "@/types/horaires";

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
