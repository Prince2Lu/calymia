import { NextResponse } from "next/server";
import { getSophrologueSession } from "@/lib/auth/sophrologue-session";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

type StatusRow = {
  google_email: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  revoked_at: string | null;
  refresh_token_enc: string | null;
};

export async function GET() {
  try {
    const session = await getSophrologueSession();
    if (!session?.sophrologue) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("google_calendar_connections")
      .select(
        "google_email, last_synced_at, last_error, revoked_at, refresh_token_enc",
      )
      .eq("sophrologue_id", session.sophrologue.id)
      .maybeSingle<StatusRow>();

    if (error) {
      console.error("[google/status]", error.message);
      return NextResponse.json(
        { error: "Impossible de lire le statut Google." },
        { status: 500 },
      );
    }

    const connected = Boolean(
      data && data.revoked_at == null && data.refresh_token_enc,
    );

    return NextResponse.json({
      connected,
      google_email: connected ? data?.google_email ?? null : null,
      last_synced_at: connected ? data?.last_synced_at ?? null : null,
      last_error: connected ? data?.last_error ?? null : null,
    });
  } catch (err) {
    console.error("[google/status]", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
