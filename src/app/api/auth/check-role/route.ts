import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const { user_id, email } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: "user_id requis." }, { status: 400 });
    }

    // 1) Sophrologue ?
    const { data: sophrologue } = await supabase
      .from("sophrologues")
      .select("id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (sophrologue) {
      console.log("[check-role] Sophrologue trouvé:", sophrologue.id);
      return NextResponse.json({ role: "sophrologue" });
    }

    // 2) Patient par user_id ?
    const { data: patientById } = await supabase
      .from("patients")
      .select("id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (patientById) {
      console.log("[check-role] Patient trouvé par user_id:", patientById.id);
      return NextResponse.json({ role: "patient" });
    }

    // 3) Patient par email (réservation faite sans compte) ?
    if (email) {
      const { data: patientByEmail } = await supabase
        .from("patients")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (patientByEmail) {
        console.log("[check-role] Patient trouvé par email:", patientByEmail.id);
        return NextResponse.json({ role: "patient" });
      }
    }

    console.log("[check-role] Aucun profil pour user_id:", user_id, "email:", email);
    return NextResponse.json({ role: "unknown" });
  } catch (err) {
    console.error("[check-role] Erreur:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
