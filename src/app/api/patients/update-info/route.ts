import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const { patient_id, prenom, nom, email, telephone } = await request.json();

    if (!patient_id) {
      return NextResponse.json(
        { error: "patient_id est requis." },
        { status: 400 },
      );
    }

    const payload: Record<string, string | null> = {};
    if (prenom !== undefined) payload.prenom = prenom?.trim() || null;
    if (nom !== undefined) payload.nom = nom?.trim() || null;
    if (email !== undefined) payload.email = email?.trim().toLowerCase() || null;
    if (telephone !== undefined) payload.telephone = telephone?.trim() || null;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { error: "Aucun champ à mettre à jour." },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("patients")
      .update(payload)
      .eq("id", patient_id);

    if (error) {
      console.error("[patients/update-info] Erreur Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[patients/update-info] Erreur inattendue:", err);
    return NextResponse.json(
      { error: "Erreur interne du serveur." },
      { status: 500 },
    );
  }
}
