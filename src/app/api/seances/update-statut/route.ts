import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ALLOWED_STATUTS = ["confirmee", "terminee", "annulee", "en_attente"];

export async function POST(request: NextRequest) {
  try {
    const { seance_id, statut } = await request.json();

    if (!seance_id || !statut) {
      return NextResponse.json(
        { error: "seance_id et statut sont requis." },
        { status: 400 },
      );
    }

    if (!ALLOWED_STATUTS.includes(statut)) {
      return NextResponse.json(
        { error: `Statut invalide. Valeurs acceptées : ${ALLOWED_STATUTS.join(", ")}` },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("seances")
      .update({ statut })
      .eq("id", seance_id);

    if (error) {
      console.error("[seances/update-statut] Erreur Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[seances/update-statut] Erreur inattendue:", err);
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
  }
}
