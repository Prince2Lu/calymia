import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST() {
  try {
    const now = new Date().toISOString();

    // 1) Find expired temporary seances
    const { data: expired } = await supabase
      .from("seances")
      .select("id")
      .eq("statut", "en_attente")
      .not("expire_at", "is", null)
      .lt("expire_at", now)
      .returns<{ id: string }[]>();

    const expiredIds = (expired ?? []).map((s) => s.id);

    if (expiredIds.length === 0) {
      return NextResponse.json({ deleted_count: 0 });
    }

    // 2) Delete any orphaned paiements linked to these seances
    await supabase
      .from("paiements")
      .delete()
      .in("seance_id", expiredIds);

    // 3) Delete the expired seances
    const { error } = await supabase
      .from("seances")
      .delete()
      .in("id", expiredIds);

    if (error) {
      console.error("[cleanup] Delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[cleanup] ${expiredIds.length} créneau(x) expiré(s) supprimé(s)`);
    return NextResponse.json({ deleted_count: expiredIds.length });
  } catch (err) {
    console.error("[cleanup] Erreur inattendue:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
