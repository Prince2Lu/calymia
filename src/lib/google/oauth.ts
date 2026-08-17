/**
 * OAuth Google Calendar — server-only.
 * Redirect URI via getSiteUrl() (NEXT_PUBLIC_APP_URL), jamais hardcodée.
 * Ne jamais logger plaintext ni ciphertext des tokens.
 */

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSiteUrl } from "@/lib/config/site-url";
import { decrypt, encrypt } from "@/lib/crypto/token-encryption";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

const STATE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
const CALYMIA_CALENDAR_SUMMARY = "Calymia";
const CALYMIA_CALENDAR_TZ = "Europe/Paris";

/** calendar.events + calendar.calendarlist + app.created (calendrier secondaire) + freebusy (primary, occupé/libre uniquement). */
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist",
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.freebusy",
] as const;

export type GoogleCalendarConnection = {
  sophrologue_id: string;
  google_email: string | null;
  refresh_token_enc: string | null;
  access_token_enc: string | null;
  access_token_expires_at: string | null;
  calendar_id: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  revoked_at: string | null;
};

function getGoogleOAuthConfig(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET manquant.");
  }
  return { clientId, clientSecret };
}

export function getGoogleRedirectUri(): string {
  return `${getSiteUrl()}/api/google/oauth/callback`;
}

export function googleParametresUrl(
  google: "connected" | "error" | "denied",
): string {
  return `${getSiteUrl()}/parametres?tab=integrations&google=${google}`;
}

export function isGoogleCalendarPlan(plan: string | null | undefined): boolean {
  const p = (plan ?? "").toLowerCase();
  return p === "professionnel" || p === "cabinet";
}

export function createOAuthState(sophrologueId: string): string {
  const { clientSecret } = getGoogleOAuthConfig();
  const payload = Buffer.from(
    JSON.stringify({
      sid: sophrologueId,
      exp: Date.now() + STATE_TTL_MS,
    }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", clientSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function parseOAuthState(state: string): { sophrologueId: string } | null {
  const dot = state.indexOf(".");
  if (dot <= 0) return null;
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  if (!payload || !sig) return null;

  const { clientSecret } = getGoogleOAuthConfig();
  const expected = createHmac("sha256", clientSecret)
    .update(payload)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  let parsed: { sid?: unknown; exp?: unknown };
  try {
    parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { sid?: unknown; exp?: unknown };
  } catch {
    return null;
  }

  if (typeof parsed.sid !== "string" || typeof parsed.exp !== "number") {
    return null;
  }
  if (Date.now() > parsed.exp) return null;
  return { sophrologueId: parsed.sid };
}

export function buildGoogleAuthUrl(state: string): string {
  const { clientId } = getGoogleOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function googleError(context: string, res: Response): Promise<never> {
  const body = await res.text().catch(() => "");
  throw new Error(
    `${context} HTTP ${res.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
  );
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getGoogleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) await googleError("Google token exchange", res);

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error("Google token exchange: access_token absent.");
  }

  const expiresInSec =
    typeof data.expires_in === "number" && data.expires_in > 0
      ? data.expires_in
      : 3600;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + expiresInSec * 1000),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) await googleError("Google token refresh", res);

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error("Google token refresh: access_token absent.");
  }

  const expiresInSec =
    typeof data.expires_in === "number" && data.expires_in > 0
      ? data.expires_in
      : 3600;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + expiresInSec * 1000),
  };
}

export async function getValidAccessToken(
  connection: GoogleCalendarConnection,
  supabase: SupabaseClient,
): Promise<string> {
  if (!connection.refresh_token_enc) {
    throw new Error("Connexion Google sans refresh token.");
  }

  const expiresAtMs = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;
  const stillValid =
    connection.access_token_enc &&
    expiresAtMs - ACCESS_TOKEN_REFRESH_MARGIN_MS > Date.now();

  if (stillValid && connection.access_token_enc) {
    return decrypt(connection.access_token_enc);
  }

  const refreshToken = decrypt(connection.refresh_token_enc);
  const refreshed = await refreshAccessToken(refreshToken);

  const accessTokenEnc = encrypt(refreshed.accessToken);
  const refreshTokenEnc = refreshed.refreshToken
    ? encrypt(refreshed.refreshToken)
    : connection.refresh_token_enc;

  const { error } = await supabase
    .from("google_calendar_connections")
    .update({
      access_token_enc: accessTokenEnc,
      refresh_token_enc: refreshTokenEnc,
      access_token_expires_at: refreshed.expiresAt.toISOString(),
    })
    .eq("sophrologue_id", connection.sophrologue_id);

  if (error) {
    console.error("[google/oauth] Échec persist refresh token:", error.message);
  }

  return refreshed.accessToken;
}

export async function fetchGoogleEmail(
  accessToken: string,
): Promise<string | null> {
  const res = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList/primary`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string };
  return data.id?.trim() || null;
}

export async function isCalendarStillValid(
  accessToken: string,
  calendarId: string,
): Promise<boolean> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.ok;
}

export async function createCalymiaCalendar(
  accessToken: string,
): Promise<string> {
  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: CALYMIA_CALENDAR_SUMMARY,
      timeZone: CALYMIA_CALENDAR_TZ,
    }),
  });
  if (!res.ok) await googleError("Google calendars.insert", res);
  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    throw new Error("Google calendars.insert: id absent.");
  }
  return data.id;
}

export async function deleteCalymiaCalendar(
  accessToken: string,
  calendarId: string,
): Promise<void> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (res.ok || res.status === 404) return;
  await googleError("Google calendars.delete", res);
}

export async function revokeGoogleToken(token: string): Promise<void> {
  const res = await fetch(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
  if (res.ok || res.status === 400) return;
  await googleError("Google token revoke", res);
}

export async function resolveCalymiaCalendarId(
  accessToken: string,
  existingCalendarId: string | null,
): Promise<{ calendarId: string; created: boolean }> {
  if (existingCalendarId) {
    const valid = await isCalendarStillValid(accessToken, existingCalendarId);
    if (valid) return { calendarId: existingCalendarId, created: false };
  }
  const calendarId = await createCalymiaCalendar(accessToken);
  return { calendarId, created: true };
}
