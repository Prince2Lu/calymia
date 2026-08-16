/**
 * FreeBusy Google Agenda (calendrier "primary" uniquement).
 * Jamais le calendrier secondaire « Calymia » — les séances Calymia sont
 * déjà exclues via seances / seances_disponibilite.
 *
 * Ne throw jamais vers l’appelant : skipped / erreur → getBusyIntervals = [].
 */

import {
  getValidAccessToken,
  type GoogleCalendarConnection,
} from "@/lib/google/oauth";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

const GOOGLE_FREEBUSY_URL =
  "https://www.googleapis.com/calendar/v3/freeBusy";
const CONNECTION_SELECT =
  "sophrologue_id, google_email, refresh_token_enc, access_token_enc, access_token_expires_at, calendar_id, connected_at, last_synced_at, last_error, revoked_at";
const FREEBUSY_TIMEOUT_MS = 2500;
const CACHE_TTL_MS = 2 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

const SLOT_CONFLICT_ERROR =
  "Ce créneau vient d'être réservé. Veuillez en choisir un autre.";
const SLOT_UNAVAILABLE_ERROR =
  "Impossible de vérifier votre disponibilité, réessayez.";

export type BusyInterval = { start: string; end: string };

export type FreeBusyQueryResult =
  | { status: "skipped" }
  | { status: "ok"; intervals: BusyInterval[] }
  | { status: "error" };

export type StrictSlotCheck =
  | { ok: true }
  | { ok: false; httpStatus: 409 | 503; error: string };

type CacheEntry = { expiresAt: number; intervals: BusyInterval[] };

const busyCache = new Map<string, CacheEntry>();

function cacheKey(sophrologueId: string, rangeStart: Date, rangeEnd: Date): string {
  const startMin = Math.floor(rangeStart.getTime() / 60_000);
  const endMin = Math.floor(rangeEnd.getTime() / 60_000);
  return `${sophrologueId}:${startMin}:${endMin}`;
}

function cacheGet(key: string): BusyInterval[] | null {
  const entry = busyCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    busyCache.delete(key);
    return null;
  }
  return entry.intervals;
}

function cacheSet(key: string, intervals: BusyInterval[]): void {
  if (busyCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = busyCache.keys().next().value;
    if (oldest !== undefined) busyCache.delete(oldest);
  }
  busyCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    intervals,
  });
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "AbortError"
  );
}

function parseBusyList(raw: unknown): BusyInterval[] {
  if (!Array.isArray(raw)) return [];
  const out: BusyInterval[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const start = (item as { start?: unknown }).start;
    const end = (item as { end?: unknown }).end;
    if (typeof start !== "string" || typeof end !== "string") continue;
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) continue;
    out.push({ start, end });
  }
  return out;
}

export function busyOverlapsSlot(
  slotStart: Date,
  slotEnd: Date,
  intervals: BusyInterval[],
): boolean {
  if (
    Number.isNaN(slotStart.getTime()) ||
    Number.isNaN(slotEnd.getTime()) ||
    slotStart >= slotEnd
  ) {
    return false;
  }
  return intervals.some(({ start, end }) => {
    const debut = new Date(start);
    const fin = new Date(end);
    if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) {
      return false;
    }
    return debut < slotEnd && fin > slotStart;
  });
}

type LoadedConnection =
  | { status: "none" }
  | { status: "error" }
  | { status: "ok"; connection: GoogleCalendarConnection };

async function loadActiveConnection(
  sophrologueId: string,
): Promise<LoadedConnection> {
  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("google_calendar_connections")
      .select(CONNECTION_SELECT)
      .eq("sophrologue_id", sophrologueId)
      .maybeSingle<GoogleCalendarConnection>();

    if (error) {
      console.error("[google/freebusy] lecture connexion:", error.message);
      return { status: "error" };
    }
    if (
      !data ||
      data.revoked_at ||
      !data.refresh_token_enc ||
      !data.calendar_id
    ) {
      return { status: "none" };
    }
    return { status: "ok", connection: data };
  } catch (err) {
    console.error("[google/freebusy] lecture connexion:", err);
    return { status: "error" };
  }
}

/**
 * Interroge FreeBusy sur "primary".
 * skipCache = true pour les checks stricts (créneau exact, pas de donnée périmée).
 */
export async function queryGoogleFreeBusy(
  sophrologueId: string,
  rangeStart: Date,
  rangeEnd: Date,
  options?: { skipCache?: boolean },
): Promise<FreeBusyQueryResult> {
  if (
    Number.isNaN(rangeStart.getTime()) ||
    Number.isNaN(rangeEnd.getTime()) ||
    rangeStart >= rangeEnd
  ) {
    return { status: "skipped" };
  }

  const loaded = await loadActiveConnection(sophrologueId);
  if (loaded.status === "none") return { status: "skipped" };
  if (loaded.status === "error") return { status: "error" };

  const key = cacheKey(sophrologueId, rangeStart, rangeEnd);
  if (!options?.skipCache) {
    const cached = cacheGet(key);
    if (cached) return { status: "ok", intervals: cached };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FREEBUSY_TIMEOUT_MS);

  try {
    const supabase = getServiceRoleClient();
    const accessToken = await getValidAccessToken(loaded.connection, supabase);

    const res = await fetch(GOOGLE_FREEBUSY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        items: [{ id: "primary" }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        "[google/freebusy] HTTP",
        res.status,
        body.slice(0, 300),
      );
      return { status: "error" };
    }

    const data = (await res.json()) as {
      calendars?: {
        primary?: {
          busy?: unknown;
          errors?: unknown;
        };
      };
    };

    const primary = data.calendars?.primary;
    if (primary?.errors && Array.isArray(primary.errors) && primary.errors.length > 0) {
      console.error("[google/freebusy] erreurs calendrier primary:", primary.errors);
      return { status: "error" };
    }

    const intervals = parseBusyList(primary?.busy);
    console.log("[freebusy][DIAG]", {
      sophrologueId,
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      calendarIdConnexion: loaded.connection.calendar_id,
      rawCalendars: JSON.stringify(data.calendars),
      intervalsCount: intervals.length,
    });
    cacheSet(key, intervals);
    return { status: "ok", intervals };
  } catch (err) {
    if (isAbortError(err)) {
      console.error("[google/freebusy] timeout", FREEBUSY_TIMEOUT_MS, "ms");
    } else {
      console.error("[google/freebusy]", err);
    }
    return { status: "error" };
  } finally {
    clearTimeout(timer);
  }
}

/** Niveau souple : jamais d’échec — [] si non connecté, timeout ou erreur. */
export async function getBusyIntervals(
  sophrologueId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<BusyInterval[]> {
  const result = await queryGoogleFreeBusy(sophrologueId, rangeStart, rangeEnd);
  return result.status === "ok" ? result.intervals : [];
}

/**
 * Niveau strict : créneau exact uniquement.
 * Non connecté → ok (identique à avant C5).
 * Timeout / erreur Google → 503. Chevauchement → 409.
 */
export async function assertPrimaryCalendarSlotAvailable(
  sophrologueId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<StrictSlotCheck> {
  const result = await queryGoogleFreeBusy(sophrologueId, rangeStart, rangeEnd, {
    skipCache: true,
  });

  if (result.status === "skipped") return { ok: true };
  if (result.status === "error") {
    return { ok: false, httpStatus: 503, error: SLOT_UNAVAILABLE_ERROR };
  }
  if (busyOverlapsSlot(rangeStart, rangeEnd, result.intervals)) {
    return { ok: false, httpStatus: 409, error: SLOT_CONFLICT_ERROR };
  }
  return { ok: true };
}
