/**
 * Fuseau horaire produit : France (données Supabase en UTC / timestamptz).
 */
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const EUROPE_PARIS = "Europe/Paris";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Calendrier grégorien tel qu’affiché à Paris (année, mois 1–12, jour). */
export function getParisYMD(instant: Date): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: EUROPE_PARIS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(instant);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  const d = Number(parts.find((p) => p.type === "day")!.value);
  return { y, m, d };
}

/** Interprète Y-M-D H:M comme heure locale Paris → instant UTC. */
export function parisYmdHmToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
): Date {
  return fromZonedTime(
    `${y}-${pad2(m)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}:00`,
    EUROPE_PARIS,
  );
}

/** Début du jour civil à Paris (00:00) en instant UTC. */
export function startOfParisCalendarDay(instant: Date): Date {
  const { y, m, d } = getParisYMD(instant);
  return parisYmdHmToUtc(y, m, d, 0, 0);
}

/** +N jours civils à Paris à partir d’un instant (référence : jour civil Paris de `instant`). */
export function addParisCalendarDays(instant: Date, deltaDays: number): Date {
  const { y, m, d } = getParisYMD(instant);
  const noon = fromZonedTime(
    `${y}-${pad2(m)}-${pad2(d)}T12:00:00`,
    EUROPE_PARIS,
  );
  const shifted = new Date(noon.getTime() + deltaDays * 86_400_000);
  const ymd = getParisYMD(shifted);
  return parisYmdHmToUtc(ymd.y, ymd.m, ymd.d, 0, 0);
}

/**
 * Jour de la semaine JS (0 = dimanche … 6 = samedi), selon l’horloge Paris.
 * Aligné avec `Date.getDay()` pour une date interprétée à Paris.
 */
export function getParisJsDayOfWeek(instant: Date): number {
  const iso = Number(formatInTimeZone(instant, EUROPE_PARIS, "i"));
  return iso === 7 ? 0 : iso;
}

/** Lundi 00:00 Paris (UTC) de la semaine qui contient `instant`. */
export function startOfWeekParisMonday(instant: Date): Date {
  const js = getParisJsDayOfWeek(instant);
  const daysFromMon = js === 0 ? 6 : js - 1;
  const start = startOfParisCalendarDay(instant);
  return addParisCalendarDays(start, -daysFromMon);
}

export function isSameParisCalendarDay(a: Date, b: Date): boolean {
  const A = getParisYMD(a);
  const B = getParisYMD(b);
  return A.y === B.y && A.m === B.m && A.d === B.d;
}

/** Fenêtre dispo (heure_debut / heure_fin interprétées à Paris) pour un jour civil Paris. */
export function dispoWindowParisDay(
  parisDayStartUtc: Date,
  dispo: { heure_debut: string; heure_fin: string },
): { start: Date; end: Date } {
  const { y, m, d } = getParisYMD(parisDayStartUtc);
  const [sh, sm = 0] = dispo.heure_debut.split(":").map(Number);
  const [eh, em = 0] = dispo.heure_fin.split(":").map(Number);
  const start = parisYmdHmToUtc(y, m, d, sh, sm);
  const end = parisYmdHmToUtc(y, m, d, eh, em);
  return { start, end };
}

/** Borne [start, endExclusive) du mois civil courant à Paris. */
export function parisCalendarMonthBounds(now: Date = new Date()): {
  start: Date;
  endExclusive: Date;
} {
  const { y, m } = getParisYMD(now);
  const start = parisYmdHmToUtc(y, m, 1, 0, 0);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const endExclusive = parisYmdHmToUtc(ny, nm, 1, 0, 0);
  return { start, endExclusive };
}

/**
 * Même instant que l’entrée, représenté pour affichage/composants comme « heure Paris »
 * (voir date-fns-tz `toZonedTime`).
 */
export function toParisTime(date: Date | string): Date {
  return toZonedTime(typeof date === "string" ? new Date(date) : date, EUROPE_PARIS);
}

const FORMAT_OPTS: Record<string, Intl.DateTimeFormatOptions> = {
  time: { hour: "2-digit", minute: "2-digit", hour12: false },
  "HH:mm": { hour: "2-digit", minute: "2-digit", hour12: false },
  date: {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  },
  dateShort: {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  },
  weekdayShort: { weekday: "short" },
  datetime: {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
  dateTimeLong: {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
};

/**
 * Formate un instant UTC (ou ISO string) pour affichage à Paris.
 * `format` : clés prédéfinies (`HH:mm`, `date`, `dateShort`, `datetime`, `time`) ou options Intl fusionnées si inconnu.
 */
export function formatParisTime(date: Date | string, format: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const preset = FORMAT_OPTS[format];
  if (preset) {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: EUROPE_PARIS,
      ...preset,
    }).format(d);
  }
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: EUROPE_PARIS,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** « Maintenant » vu comme date locale Paris (pour composants type toZonedTime). */
export function nowInParis(): Date {
  return toZonedTime(new Date(), EUROPE_PARIS);
}

/** Heure entière (0–23) à Paris pour un instant UTC. */
export function getParisHour(isoOrDate: string | Date): number {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return Number(formatInTimeZone(d, EUROPE_PARIS, "H"));
}
