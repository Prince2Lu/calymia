import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const { user_id, email } = await request.json();

    if (!user_id || !email) {
      return NextResponse.json(
        { error: "user_id et email requis." },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("patients")
      .update({ user_id })
      .eq("email", email.trim().toLowerCase());

    if (error) {
      console.error("[link-patient] Erreur:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[link-patient] Patient lié — user_id:", user_id, "email:", email);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[link-patient] Erreur inattendue:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
