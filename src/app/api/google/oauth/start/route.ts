import { NextResponse } from "next/server";
import { getSophrologueSession } from "@/lib/auth/sophrologue-session";
import {
  buildGoogleAuthUrl,
  createOAuthState,
  isGoogleCalendarPlan,
} from "@/lib/google/oauth";

export async function GET() {
  try {
    const session = await getSophrologueSession();
    if (!session?.sophrologue) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    if (!isGoogleCalendarPlan(session.sophrologue.plan)) {
      return NextResponse.json(
        {
          error:
            "Google Agenda est réservé aux plans Professionnel et Cabinet.",
        },
        { status: 403 },
      );
    }

    const state = createOAuthState(session.sophrologue.id);
    return NextResponse.redirect(buildGoogleAuthUrl(state));
  } catch (err) {
    console.error("[google/oauth/start]", err);
    return NextResponse.json(
      { error: "Impossible de démarrer la connexion Google." },
      { status: 500 },
    );
  }
}
