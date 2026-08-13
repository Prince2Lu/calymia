import { dispoWindowParisDay } from "@/lib/timezone";
import type { DispoWindow } from "@/lib/horaires";

export type BookedInterval = { debut: Date; fin: Date };

export const SLOT_GRID_STEP_MS = 30 * 60 * 1000; // pas de 30 min (30, 45, 60, 90…)

/** Vérifie chevauchement avec une séance existante (durée = type choisi) */
function isSlotBooked(
  slotStart: Date,
  bookedIntervals: BookedInterval[],
  slotDurationMs: number,
): boolean {
  const slotEnd = new Date(slotStart.getTime() + slotDurationMs);
  return bookedIntervals.some(
    ({ debut, fin }) => debut < slotEnd && fin > slotStart,
  );
}

/** Créneaux disponibles pour un jour, selon la durée du type de séance */
export function buildSlotsFromDispo(
  day: Date,
  dispos: DispoWindow[],
  bookedIntervals: BookedInterval[],
  delaiMinHeures: number,
  slotDurationMs: number,
): Date[] {
  const allSlots: Date[] = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + delaiMinHeures * 60 * 60 * 1000);

  for (const dispo of dispos) {
    const { start, end } = dispoWindowParisDay(day, dispo);
    for (
      let t = start.getTime();
      t + slotDurationMs <= end.getTime();
      t += SLOT_GRID_STEP_MS
    ) {
      const slot = new Date(t);
      if (slot <= cutoff) continue;
      if (isSlotBooked(slot, bookedIntervals, slotDurationMs)) {
        continue;
      }
      allSlots.push(slot);
    }
  }

  const seen = new Set<number>();
  return allSlots
    .filter((s) => {
      const k = s.getTime();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.getTime() - b.getTime());
}
