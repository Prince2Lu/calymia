import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sophrologue_id, prenom, nom, email, telephone } = body;

    if (!sophrologue_id || !prenom || !nom || !email) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants (sophrologue_id, prenom, nom, email)." },
        { status: 400 },
      );
    }

    const { data: patient, error } = await supabase
      .from("patients")
      .insert({
        sophrologue_id,
        prenom: prenom.trim(),
        nom: nom.trim(),
        email: email.trim().toLowerCase(),
        telephone: telephone?.trim() ?? null,
      })
      .select("id, prenom, nom, email, telephone, created_at")
      .single();

    if (error) {
      console.error("[patients/create] Erreur Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ patient }, { status: 201 });
  } catch (err) {
    console.error("[patients/create] Erreur inattendue:", err);
    return NextResponse.json(
      { error: "Erreur interne du serveur." },
      { status: 500 },
    );
  }
}
