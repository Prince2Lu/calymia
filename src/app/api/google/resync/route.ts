import { NextResponse } from "next/server";
import { getSophrologueSession } from "@/lib/auth/sophrologue-session";
import { upsertSeanceEvent } from "@/lib/google/calendar-sync";
import { isGoogleCalendarPlan } from "@/lib/google/oauth";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

const RESYNC_HORIZON_MS = 90 * 24 * 60 * 60 * 1000;

export async function POST() {
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

    const now = new Date();
    const horizon = new Date(now.getTime() + RESYNC_HORIZON_MS);
    const supabase = getServiceRoleClient();

    const { data: seances, error } = await supabase
      .from("seances")
      .select("id")
      .eq("sophrologue_id", session.sophrologue.id)
      .eq("statut", "confirmee")
      .gte("debut_at", now.toISOString())
      .lt("debut_at", horizon.toISOString())
      .returns<{ id: string }[]>();

    if (error) {
      console.error("[google/resync]", error.message);
      return NextResponse.json(
        { error: "Impossible de lister les séances à synchroniser." },
        { status: 500 },
      );
    }

    const ids = (seances ?? []).map((s) => s.id);
    let success = 0;
    let errors = 0;
    for (const id of ids) {
      const ok = await upsertSeanceEvent(id);
      if (ok) success += 1;
      else errors += 1;
    }

    return NextResponse.json({
      total: ids.length,
      success,
      errors,
    });
  } catch (err) {
    console.error("[google/resync]", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
