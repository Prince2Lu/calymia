import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function assertCronAuthorized(request: Request): NextResponse | null {
  if (
    request.headers.get("authorization") !==
    `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Même fenêtre que bloquer-creneau (expire_at = now + 15 min) */
const HOLD_MINUTES = 15;

async function runCleanup(): Promise<NextResponse> {
  try {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const staleCreatedBeforeIso = new Date(
      nowMs - HOLD_MINUTES * 60 * 1000,
    ).toISOString();

    // 1a) Blocs temporaires dont expire_at est dépassé
    const { data: expiredByExpireAt } = await supabase
      .from("seances")
      .select("id")
      .eq("statut", "en_attente")
      .not("expire_at", "is", null)
      .lt("expire_at", nowIso)
      .returns<{ id: string }[]>();

    // 1b) Anciennes séances en_attente sans expire_at (créées avant la colonne)
    //     équivalent SQL : expire_at IS NULL AND created_at < NOW() - interval '15 minutes'
    const { data: staleWithoutExpireAt } = await supabase
      .from("seances")
      .select("id")
      .eq("statut", "en_attente")
      .is("expire_at", null)
      .lt("created_at", staleCreatedBeforeIso)
      .returns<{ id: string }[]>();

    const idSet = new Set<string>();
    for (const row of expiredByExpireAt ?? []) idSet.add(String(row.id));
    for (const row of staleWithoutExpireAt ?? []) idSet.add(String(row.id));
    const expiredIds = [...idSet];

    if (expiredIds.length === 0) {
      return NextResponse.json({ deleted_count: 0 });
    }

    // 2) Delete any orphaned paiements linked to these seances
    await supabase.from("paiements").delete().in("seance_id", expiredIds);

    // 3) Delete the expired / stale seances
    const { error } = await supabase
      .from("seances")
      .delete()
      .in("id", expiredIds);

    if (error) {
      console.error("[cleanup] Delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(
      `[cleanup] ${expiredIds.length} créneau(x) supprimé(s) (expire_at dépassé ou sans expire_at > ${HOLD_MINUTES} min)`,
    );
    return NextResponse.json({ deleted_count: expiredIds.length });
  } catch (err) {
    console.error("[cleanup] Erreur inattendue:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}

/** Vercel Cron appelle les routes en GET par défaut */
export async function GET(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) return unauthorized;
  return runCleanup();
}

export async function POST(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) return unauthorized;
  return runCleanup();
}
