/**
 * Push Calymia → Google Agenda (séances confirmées uniquement).
 * Ne jamais appeler hors d’un try/catch isolé — ces fonctions ne throwent pas.
 */

import { formatInTimeZone } from "date-fns-tz";
import {
  getValidAccessToken,
  type GoogleCalendarConnection,
} from "@/lib/google/oauth";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { EUROPE_PARIS } from "@/lib/timezone";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const CONNECTION_SELECT =
  "sophrologue_id, google_email, refresh_token_enc, access_token_enc, access_token_expires_at, calendar_id, connected_at, last_synced_at, last_error, revoked_at";

type PatientLite = { prenom: string | null; nom: string | null };
type TypeSeanceLite = { nom: string | null; mode: string | null };

type SeanceSyncRow = {
  id: string;
  sophrologue_id: string;
  debut_at: string;
  fin_at: string;
  statut: string;
  lien_teleconsultation: string | null;
  google_event_id: string | null;
  patient: PatientLite | PatientLite[] | null;
  type_seance: TypeSeanceLite | TypeSeanceLite[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function errorMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

function parisDateTime(iso: string): { dateTime: string; timeZone: string } {
  return {
    dateTime: formatInTimeZone(new Date(iso), EUROPE_PARIS, "yyyy-MM-dd'T'HH:mm:ss"),
    timeZone: EUROPE_PARIS,
  };
}

function eventTitle(
  typeNom: string | null,
  prenom: string | null,
  nom: string | null,
): string {
  const type = (typeNom ?? "").trim() || "Séance";
  const prenomClean = (prenom ?? "").trim();
  const initial = (nom ?? "").trim().charAt(0).toUpperCase();
  const person = [prenomClean, initial ? `${initial}.` : ""]
    .filter(Boolean)
    .join(" ");
  return person ? `${type} — ${person}` : type;
}

function eventDescription(
  mode: string | null,
  lienTeleconsultation: string | null,
): string {
  const lieu = mode === "visio" ? "Visio" : "Présentiel";
  const lien = lienTeleconsultation?.trim() ?? "";
  return lien ? `${lieu}\n${lien}` : lieu;
}

async function googleError(context: string, res: Response): Promise<never> {
  const body = await res.text().catch(() => "");
  throw new Error(
    `${context} HTTP ${res.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
  );
}

async function loadSeance(seanceId: string): Promise<SeanceSyncRow | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("seances")
    .select(
      `id, sophrologue_id, debut_at, fin_at, statut, lien_teleconsultation, google_event_id,
       patient:patients(prenom, nom),
       type_seance:types_seances(nom, mode)`,
    )
    .eq("id", seanceId)
    .maybeSingle<SeanceSyncRow>();

  if (error) {
    console.error("[google/calendar-sync] lecture séance:", error.message);
    return null;
  }
  return data ?? null;
}

async function loadActiveConnection(
  sophrologueId: string,
): Promise<GoogleCalendarConnection | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select(CONNECTION_SELECT)
    .eq("sophrologue_id", sophrologueId)
    .maybeSingle<GoogleCalendarConnection>();

  if (error) {
    console.error("[google/calendar-sync] lecture connexion:", error.message);
    return null;
  }
  if (!data || data.revoked_at || !data.refresh_token_enc || !data.calendar_id) {
    return null;
  }
  return data;
}

async function markConnectionSuccess(sophrologueId: string): Promise<void> {
  const supabase = getServiceRoleClient();
  const { error } = await supabase
    .from("google_calendar_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("sophrologue_id", sophrologueId);
  if (error) {
    console.error("[google/calendar-sync] last_synced_at:", error.message);
  }
}

async function markConnectionError(
  sophrologueId: string,
  err: unknown,
): Promise<void> {
  const msg = errorMessage(err);
  console.error("[google/calendar-sync]", sophrologueId, msg);
  try {
    const supabase = getServiceRoleClient();
    await supabase
      .from("google_calendar_connections")
      .update({ last_error: msg })
      .eq("sophrologue_id", sophrologueId);
  } catch (writeErr) {
    console.error("[google/calendar-sync] écriture last_error:", writeErr);
  }
}

function buildEventBody(seance: SeanceSyncRow) {
  const patient = one(seance.patient);
  const typeSeance = one(seance.type_seance);
  return {
    summary: eventTitle(
      typeSeance?.nom ?? null,
      patient?.prenom ?? null,
      patient?.nom ?? null,
    ),
    description: eventDescription(
      typeSeance?.mode ?? null,
      seance.lien_teleconsultation,
    ),
    start: parisDateTime(seance.debut_at),
    end: parisDateTime(seance.fin_at),
    extendedProperties: {
      private: { calymia_seance_id: seance.id },
    },
  };
}

async function insertOrPatchEvent(
  seance: SeanceSyncRow,
  connection: GoogleCalendarConnection,
): Promise<string> {
  const supabase = getServiceRoleClient();
  const accessToken = await getValidAccessToken(connection, supabase);
  const calendarId = encodeURIComponent(connection.calendar_id!);
  const body = buildEventBody(seance);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  if (seance.google_event_id) {
    const patchUrl = `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events/${encodeURIComponent(seance.google_event_id)}`;
    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    if (patchRes.ok) return seance.google_event_id;
    if (patchRes.status !== 404) {
      await googleError("Google events.patch", patchRes);
    }
  }

  const insertRes = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
  );
  if (!insertRes.ok) await googleError("Google events.insert", insertRes);
  const data = (await insertRes.json()) as { id?: string };
  if (!data.id) throw new Error("Google events.insert: id absent.");
  return data.id;
}

async function deleteGoogleEvent(
  seance: SeanceSyncRow,
  connection: GoogleCalendarConnection,
): Promise<void> {
  const supabase = getServiceRoleClient();
  const accessToken = await getValidAccessToken(connection, supabase);
  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(connection.calendar_id!)}/events/${encodeURIComponent(seance.google_event_id!)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.ok || res.status === 404) return;
  await googleError("Google events.delete", res);
}

/**
 * @returns false si l’appel Google a échoué après 1 retry ; true sinon (succès ou no-op).
 * Ne throw jamais.
 */
export async function upsertSeanceEvent(seanceId: string): Promise<boolean> {
  try {
    const seance = await loadSeance(seanceId);
    if (!seance) return true;

    if (seance.statut === "annulee" && seance.google_event_id) {
      return deleteSeanceEvent(seanceId);
    }

    if (seance.statut !== "confirmee") return true;

    const connection = await loadActiveConnection(seance.sophrologue_id);
    if (!connection) return true;

    try {
      const eventId = await insertOrPatchEvent(seance, connection);
      if (eventId !== seance.google_event_id) {
        const supabase = getServiceRoleClient();
        const { error } = await supabase
          .from("seances")
          .update({ google_event_id: eventId })
          .eq("id", seance.id);
        if (error) {
          console.error(
            "[google/calendar-sync] persist google_event_id:",
            error.message,
          );
        }
      }
      await markConnectionSuccess(seance.sophrologue_id);
      return true;
    } catch (firstErr) {
      try {
        const eventId = await insertOrPatchEvent(seance, connection);
        if (eventId !== seance.google_event_id) {
          const supabase = getServiceRoleClient();
          await supabase
            .from("seances")
            .update({ google_event_id: eventId })
            .eq("id", seance.id);
        }
        await markConnectionSuccess(seance.sophrologue_id);
        return true;
      } catch (secondErr) {
        await markConnectionError(seance.sophrologue_id, secondErr ?? firstErr);
        return false;
      }
    }
  } catch (err) {
    console.error("[google/calendar-sync] upsert inattendu:", err);
    return false;
  }
}

/**
 * @returns false si l’appel Google a échoué après 1 retry ; true sinon (succès ou no-op).
 * Ne throw jamais. 404 Google = succès.
 */
export async function deleteSeanceEvent(seanceId: string): Promise<boolean> {
  try {
    const seance = await loadSeance(seanceId);
    if (!seance?.google_event_id) return true;

    const connection = await loadActiveConnection(seance.sophrologue_id);
    if (!connection) return true;

    const clearEventId = async () => {
      const supabase = getServiceRoleClient();
      const { error } = await supabase
        .from("seances")
        .update({ google_event_id: null })
        .eq("id", seance.id);
      if (error) {
        console.error(
          "[google/calendar-sync] clear google_event_id:",
          error.message,
        );
      }
    };

    try {
      await deleteGoogleEvent(seance, connection);
      await clearEventId();
      await markConnectionSuccess(seance.sophrologue_id);
      return true;
    } catch (firstErr) {
      try {
        await deleteGoogleEvent(seance, connection);
        await clearEventId();
        await markConnectionSuccess(seance.sophrologue_id);
        return true;
      } catch (secondErr) {
        await markConnectionError(seance.sophrologue_id, secondErr ?? firstErr);
        return false;
      }
    }
  } catch (err) {
    console.error("[google/calendar-sync] delete inattendu:", err);
    return false;
  }
}
