/**
 * Horaires vitrine publique — normalisation JSONB + repli sur `disponibilites`.
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

/** Au moins une plage renseignée (après normalisation). */
export function hasHorairesContenu(h: HorairesSophrologue): boolean {
  return JOURS_SEMAINE.some((j) => (h[j] ?? []).length > 0);
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
 * Horaires affichés sur la page publique : JSONB `sophrologues.horaires` en priorité,
 * sinon repli sur les disponibilités (étape onboarding / onglet Disponibilités).
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
