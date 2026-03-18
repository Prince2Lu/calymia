import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "id est requis." }, { status: 400 });
    }

    // Vérifier qu'aucune séance n'utilise ce type avant de supprimer
    const { count } = await supabase
      .from("seances")
      .select("id", { count: "exact", head: true })
      .eq("type_seance_id", id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: "Ce type de séance est utilisé par des séances existantes. Désactivez-le plutôt que de le supprimer." },
        { status: 409 },
      );
    }

    const { error } = await supabase.from("types_seances").delete().eq("id", id);

    if (error) {
      console.error("[types-seances/delete]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[types-seances/delete] inattendu:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
