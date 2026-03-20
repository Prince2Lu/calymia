import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** Service role : lecture/suppression sur `seances` / `paiements` sans RLS (requis pour le cron). */
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
    /** Référence UTC (suffixe Z) — cohérent avec `timestamptz` / comparaisons Supabase */
    const now = new Date(nowMs).toISOString();
    const staleCreatedBeforeIso = new Date(
      nowMs - HOLD_MINUTES * 60 * 1000,
    ).toISOString();

    console.log("[cleanup] now:", now);
    console.log(
      "[cleanup] using Supabase client: SERVICE_ROLE (SUPABASE_SERVICE_ROLE_KEY) — RLS bypassed",
    );

    const { count: totalEnAttente, error: errTotal } = await supabase
      .from("seances")
      .select("*", { count: "exact", head: true })
      .eq("statut", "en_attente");

    if (errTotal) {
      console.error("[cleanup] count en_attente error:", errTotal);
    }
    console.log(
      "[cleanup] seances en_attente (total):",
      totalEnAttente ?? 0,
    );

    const { count: withExpireAtNotNull, error: errExpireSet } = await supabase
      .from("seances")
      .select("*", { count: "exact", head: true })
      .eq("statut", "en_attente")
      .not("expire_at", "is", null);

    if (errExpireSet) {
      console.error("[cleanup] count expire_at not null error:", errExpireSet);
    }
    console.log(
      "[cleanup] en_attente with expire_at NOT NULL:",
      withExpireAtNotNull ?? 0,
    );

    const { count: withExpireAtPast, error: errExpirePast } = await supabase
      .from("seances")
      .select("*", { count: "exact", head: true })
      .eq("statut", "en_attente")
      .not("expire_at", "is", null)
      .lt("expire_at", now);

    if (errExpirePast) {
      console.error("[cleanup] count expire_at < now error:", errExpirePast);
    }
    console.log(
      "[cleanup] en_attente with expire_at < now:",
      withExpireAtPast ?? 0,
    );

    // 1a) Blocs temporaires dont expire_at est dépassé
    const { data: expiredByExpireAt, error: errExpiredRows } = await supabase
      .from("seances")
      .select("id, expire_at")
      .eq("statut", "en_attente")
      .not("expire_at", "is", null)
      .lt("expire_at", now)
      .returns<{ id: string; expire_at: string }[]>();

    if (errExpiredRows) {
      console.error("[cleanup] select expiredByExpireAt error:", errExpiredRows);
    }

    // 1b) Anciennes séances en_attente sans expire_at (créées avant la colonne)
    const { data: staleWithoutExpireAt, error: errStaleRows } = await supabase
      .from("seances")
      .select("id, created_at")
      .eq("statut", "en_attente")
      .is("expire_at", null)
      .lt("created_at", staleCreatedBeforeIso)
      .returns<{ id: string; created_at: string }[]>();

    if (errStaleRows) {
      console.error("[cleanup] select staleWithoutExpireAt error:", errStaleRows);
    }

    console.log(
      "[cleanup] expired rows (expire_at < now):",
      expiredByExpireAt ?? [],
    );
    console.log(
      "[cleanup] stale rows (expire_at IS NULL, created_at <",
      staleCreatedBeforeIso,
      "):",
      staleWithoutExpireAt ?? [],
    );

    const idSet = new Set<string>();
    for (const row of expiredByExpireAt ?? []) idSet.add(String(row.id));
    for (const row of staleWithoutExpireAt ?? []) idSet.add(String(row.id));
    const expiredIds = [...idSet];

    console.log("[cleanup] merged ids to delete:", expiredIds);

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
