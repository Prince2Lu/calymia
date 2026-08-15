import { NextRequest, NextResponse } from "next/server";
import { getSophrologueSession } from "@/lib/auth/sophrologue-session";
import { encrypt } from "@/lib/crypto/token-encryption";
import {
  deleteCalymiaCalendar,
  exchangeCodeForTokens,
  fetchGoogleEmail,
  googleParametresUrl,
  parseOAuthState,
  resolveCalymiaCalendarId,
  type GoogleCalendarConnection,
} from "@/lib/google/oauth";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

function redirectParametres(google: "connected" | "error" | "denied") {
  return NextResponse.redirect(googleParametresUrl(google));
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const errorParam = url.searchParams.get("error");
  if (errorParam === "access_denied") {
    return redirectParametres("denied");
  }
  if (errorParam) {
    console.error("[google/oauth/callback] Google error:", errorParam);
    return redirectParametres("error");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return redirectParametres("error");
  }

  let createdCalendarId: string | null = null;
  let accessTokenForCleanup: string | null = null;

  try {
    const parsed = parseOAuthState(state);
    if (!parsed) {
      return redirectParametres("error");
    }

    const session = await getSophrologueSession();
    if (!session?.sophrologue) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }
    if (session.sophrologue.id !== parsed.sophrologueId) {
      return redirectParametres("error");
    }

    const sophrologueId = session.sophrologue.id;

    const tokens = await exchangeCodeForTokens(code);
    accessTokenForCleanup = tokens.accessToken;

    const supabase = getServiceRoleClient();
    const { data: existing } = await supabase
      .from("google_calendar_connections")
      .select(
        "sophrologue_id, refresh_token_enc, calendar_id, revoked_at",
      )
      .eq("sophrologue_id", sophrologueId)
      .maybeSingle<
        Pick<
          GoogleCalendarConnection,
          "sophrologue_id" | "refresh_token_enc" | "calendar_id" | "revoked_at"
        >
      >();

    const reusedRefreshEnc =
      !tokens.refreshToken &&
      existing &&
      existing.revoked_at == null &&
      existing.refresh_token_enc
        ? existing.refresh_token_enc
        : null;

    if (!tokens.refreshToken && !reusedRefreshEnc) {
      console.error(
        "[google/oauth/callback] refresh_token absent (reconnect sans token stocké).",
      );
      return redirectParametres("error");
    }

    const refreshTokenEnc = tokens.refreshToken
      ? encrypt(tokens.refreshToken)
      : reusedRefreshEnc!;
    const accessTokenEnc = encrypt(tokens.accessToken);

    const existingCalendarId =
      existing?.revoked_at == null ? existing?.calendar_id ?? null : null;

    const { calendarId, created } = await resolveCalymiaCalendarId(
      tokens.accessToken,
      existingCalendarId,
    );
    if (created) createdCalendarId = calendarId;

    const googleEmail = await fetchGoogleEmail(tokens.accessToken);

    const { error: upsertError } = await supabase
      .from("google_calendar_connections")
      .upsert(
        {
          sophrologue_id: sophrologueId,
          google_email: googleEmail,
          refresh_token_enc: refreshTokenEnc,
          access_token_enc: accessTokenEnc,
          access_token_expires_at: tokens.expiresAt.toISOString(),
          calendar_id: calendarId,
          connected_at: new Date().toISOString(),
          last_error: null,
          revoked_at: null,
        },
        { onConflict: "sophrologue_id" },
      );

    if (upsertError) {
      console.error("[google/oauth/callback] upsert:", upsertError.message);
      throw new Error("upsert google_calendar_connections");
    }

    return redirectParametres("connected");
  } catch (err) {
    console.error("[google/oauth/callback]", err);
    if (createdCalendarId && accessTokenForCleanup) {
      try {
        await deleteCalymiaCalendar(accessTokenForCleanup, createdCalendarId);
      } catch (cleanupErr) {
        console.error(
          "[google/oauth/callback] cleanup calendrier:",
          cleanupErr,
        );
      }
    }
    return redirectParametres("error");
  }
}
