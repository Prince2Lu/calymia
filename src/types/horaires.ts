export interface PlageHoraire {
  debut: string;
  fin: string;
}

export type HorairesSophrologue = {
  [jour: string]: PlageHoraire[];
};

export const JOURS_SEMAINE = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
] as const;

export type JourSemaine = (typeof JOURS_SEMAINE)[number];

export const JOURS_LABELS: Record<string, string> = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
  dimanche: "Dimanche",
};

export const emptyHoraires = (): HorairesSophrologue =>
  Object.fromEntries(JOURS_SEMAINE.map((j) => [j, []])) as HorairesSophrologue;

function isPlageHoraire(v: unknown): v is PlageHoraire {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.debut === "string" && typeof o.fin === "string";
}

/** Compatibilité lecture ancien format `{ actif, debut, fin }` */
export const normalizeHoraires = (raw: unknown): HorairesSophrologue => {
  if (!raw || typeof raw !== "object") return emptyHoraires();
  const result = emptyHoraires();
  const o = raw as Record<string, unknown>;
  for (const jour of JOURS_SEMAINE) {
    const val = o[jour];
    if (Array.isArray(val)) {
      result[jour] = val.filter(isPlageHoraire).map((p) => ({
        debut: p.debut,
        fin: p.fin,
      }));
    } else if (val && typeof val === "object" && "actif" in val) {
      const old = val as { actif: boolean; debut: string; fin: string };
      result[jour] =
        old.actif && old.debut && old.fin
          ? [{ debut: old.debut, fin: old.fin }]
          : [];
    }
  }
  return result;
};
