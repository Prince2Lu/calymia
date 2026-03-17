import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const { patient_id, notes } = await request.json();

    if (!patient_id) {
      return NextResponse.json(
        { error: "patient_id est requis." },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("patients")
      .update({ notes: notes ?? null })
      .eq("id", patient_id);

    if (error) {
      console.error("[patients/update-notes] Erreur Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[patients/update-notes] Erreur inattendue:", err);
    return NextResponse.json(
      { error: "Erreur interne du serveur." },
      { status: 500 },
    );
  }
}
