import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const { email, password, patient_email } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "email et password requis." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 8 caractères." },
        { status: 400 },
      );
    }

    // Create auth user (auto-confirm email)
    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (error) {
      console.error("[create-client-account] createUser error:", error);
      // Supabase returns a 422 or message containing "already" when email is taken
      if (
        error.status === 422 ||
        error.message.toLowerCase().includes("already") ||
        error.message.toLowerCase().includes("exists")
      ) {
        return NextResponse.json({ error: "exists" });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const userId = data.user.id;
    console.log("[create-client-account] Compte créé:", userId, "pour", email);

    // Link the patient record (use patient_email which may differ from login email)
    const lookupEmail = (patient_email ?? email).trim().toLowerCase();
    const { error: updateError } = await supabase
      .from("patients")
      .update({ user_id: userId })
      .eq("email", lookupEmail)
      .is("user_id", null); // only link if not already linked

    if (updateError) {
      console.error("[create-client-account] Liaison patient échouée:", updateError);
    } else {
      console.log("[create-client-account] Patient lié pour email:", lookupEmail);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[create-client-account] Erreur inattendue:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
