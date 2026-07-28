/**
 * Calcule le prochain créneau réservable — aligné sur la logique du tunnel
 * `reserver` (horaires JSONB + séances réservées + délai min).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dispoByJsDayFromHoraires,
  normalizeHoraires,
  type DispoWindow,
} from "@/lib/horaires";
import {
  addParisCalendarDays,
  dispoWindowParisDay,
  getParisJsDayOfWeek,
  startOfParisCalendarDay,
} from "@/lib/timezone";

type BookedInterval = { debut: Date; fin: Date };

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

const SLOT_GRID_STEP_MS = 15 * 60 * 1000;

function buildSlotsFromDispo(
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

/**
 * Retourne l’ISO du premier créneau libre dans les 28 prochains jours, ou null.
 */
export async function computeNextAvailableSlotIso(
  supabase: SupabaseClient,
  sophrologueId: string,
): Promise<string | null> {
  const horizon = addParisCalendarDays(
    startOfParisCalendarDay(new Date()),
    29,
  ).toISOString();
  const nowIso = new Date().toISOString();

  const [
    { data: sophro },
    { data: seances },
    { data: params },
    { data: typesRows },
  ] = await Promise.all([
    supabase
      .from("sophrologues")
      .select("horaires")
      .eq("id", sophrologueId)
      .maybeSingle<{ horaires: unknown }>(),
    supabase
      .from("seances_disponibilite")
      .select("debut_at, fin_at")
      .eq("sophrologue_id", sophrologueId)
      .in("statut", ["confirmee", "en_attente"])
      .gt("debut_at", nowIso)
      .lt("debut_at", horizon)
      .or(`expire_at.is.null,expire_at.gt.${nowIso}`)
      .returns<{ debut_at: string; fin_at: string }[]>(),
    supabase
      .from("parametres_cabinet")
      .select("delai_min_reservation_heures")
      .eq("sophrologue_id", sophrologueId)
      .maybeSingle<{ delai_min_reservation_heures: number }>(),
    supabase
      .from("types_seances")
      .select("duree_minutes")
      .eq("sophrologue_id", sophrologueId)
      .eq("actif", true)
      .returns<{ duree_minutes: number | null }[]>(),
  ]);

  const dispoByJsDay = dispoByJsDayFromHoraires(
    normalizeHoraires(sophro?.horaires),
  );

  if (dispoByJsDay.size === 0) return null;

  const bookedIntervals: BookedInterval[] = (seances ?? []).map((s) => ({
    debut: new Date(s.debut_at),
    fin: new Date(s.fin_at),
  }));

  const delaiMinHeures = params?.delai_min_reservation_heures ?? 24;

  const durations = (typesRows ?? [])
    .map((r) => Number(r.duree_minutes) || 60)
    .filter((n) => n > 0);
  const durationMinutes = durations.length > 0 ? Math.min(...durations) : 60;
  const slotDurationMs = durationMinutes * 60 * 1000;

  const today = startOfParisCalendarDay(new Date());
  for (let i = 0; i < 28; i++) {
    const d = addParisCalendarDays(today, i);
    const dayDispos = dispoByJsDay.get(getParisJsDayOfWeek(d));
    if (!dayDispos?.length) continue;
    const slots = buildSlotsFromDispo(
      d,
      dayDispos,
      bookedIntervals,
      delaiMinHeures,
      slotDurationMs,
    );
    if (slots.length > 0) return slots[0]!.toISOString();
  }

  return null;
}
