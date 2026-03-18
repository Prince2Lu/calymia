import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const { sophrologue_id, nom, duree_minutes, tarif } = await request.json();

    if (!sophrologue_id || !nom || duree_minutes == null || tarif == null) {
      return NextResponse.json(
        { error: "sophrologue_id, nom, duree_minutes et tarif sont requis." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("types_seances")
      .insert({
        sophrologue_id,
        nom: nom.trim(),
        duree_minutes: Number(duree_minutes),
        tarif: Number(tarif),
        actif: true,
      })
      .select("id, nom, duree_minutes, tarif, actif")
      .single();

    if (error) {
      console.error("[types-seances/create]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ type_seance: data }, { status: 201 });
  } catch (err) {
    console.error("[types-seances/create] inattendu:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
