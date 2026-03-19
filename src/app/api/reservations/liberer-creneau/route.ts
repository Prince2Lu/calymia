import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const { seance_id } = await request.json() as { seance_id?: string | number };

    if (!seance_id) {
      return NextResponse.json({ error: "seance_id requis." }, { status: 400 });
    }

    // Only delete temporary (en_attente) blocks — never touch confirmed seances
    const { error } = await supabase
      .from("seances")
      .delete()
      .eq("id", seance_id)
      .eq("statut", "en_attente")
      .not("expire_at", "is", null); // safety: only remove slots that have an expiry

    if (error) {
      console.error("[liberer-creneau] Delete error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[liberer-creneau] Créneau libéré:", seance_id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[liberer-creneau] Erreur inattendue:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
