import { NextResponse } from "next/server";
import { getSophrologueSession } from "@/lib/auth/sophrologue-session";
import { decrypt } from "@/lib/crypto/token-encryption";
import {
  deleteCalymiaCalendar,
  getValidAccessToken,
  revokeGoogleToken,
  type GoogleCalendarConnection,
} from "@/lib/google/oauth";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST() {
  try {
    const session = await getSophrologueSession();
    if (!session?.sophrologue) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const sophrologueId = session.sophrologue.id;
    const supabase = getServiceRoleClient();

    const { data: connection, error: readError } = await supabase
      .from("google_calendar_connections")
      .select(
        "sophrologue_id, google_email, refresh_token_enc, access_token_enc, access_token_expires_at, calendar_id, connected_at, last_synced_at, last_error, revoked_at",
      )
      .eq("sophrologue_id", sophrologueId)
      .maybeSingle<GoogleCalendarConnection>();

    if (readError) {
      console.error("[google/oauth/disconnect] lecture:", readError.message);
      return NextResponse.json(
        { error: "Impossible de lire la connexion Google." },
        { status: 500 },
      );
    }

    if (!connection || connection.revoked_at) {
      return NextResponse.json({ success: true, already: true });
    }

    let accessToken: string | null = null;
    try {
      accessToken = await getValidAccessToken(connection, supabase);
    } catch (tokenErr) {
      console.error("[google/oauth/disconnect] access token:", tokenErr);
    }

    if (accessToken && connection.calendar_id) {
      try {
        await deleteCalymiaCalendar(accessToken, connection.calendar_id);
      } catch (calErr) {
        console.error("[google/oauth/disconnect] delete calendrier:", calErr);
      }
    }

    if (!accessToken && connection.refresh_token_enc) {
      try {
        accessToken = decrypt(connection.refresh_token_enc);
      } catch (decErr) {
        console.error("[google/oauth/disconnect] decrypt refresh:", decErr);
      }
    }
    if (accessToken) {
      try {
        await revokeGoogleToken(accessToken);
      } catch (revokeErr) {
        console.error("[google/oauth/disconnect] revoke:", revokeErr);
      }
    }

    const { error: updateError } = await supabase
      .from("google_calendar_connections")
      .update({
        refresh_token_enc: null,
        access_token_enc: null,
        access_token_expires_at: null,
        revoked_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("sophrologue_id", sophrologueId);

    if (updateError) {
      console.error("[google/oauth/disconnect] update:", updateError.message);
      return NextResponse.json(
        { error: "Impossible de déconnecter Google Agenda." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[google/oauth/disconnect]", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
