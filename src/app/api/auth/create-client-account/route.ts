import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const {
      email,
      password,
      patient_email,
      prenom,
      nom,
      create_patient_record,
    } = await request.json() as {
      email?: string;
      password?: string;
      patient_email?: string;
      prenom?: string;
      nom?: string;
      create_patient_record?: boolean;
    };

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

    const normalisedEmail = email.trim().toLowerCase();

    // ── Create auth user (auto-confirm) ───────────────────────────────────
    const { data, error } = await supabase.auth.admin.createUser({
      email: normalisedEmail,
      password,
      email_confirm: true,
    });

    if (error) {
      console.error("[create-client-account] createUser error:", error);
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
    console.log("[create-client-account] Compte créé:", userId, "pour", normalisedEmail);

    // ── Option A: link an existing patient record by email ────────────────
    const lookupEmail = (patient_email ?? email).trim().toLowerCase();
    const { error: linkError } = await supabase
      .from("patients")
      .update({ user_id: userId })
      .eq("email", lookupEmail)
      .is("user_id", null);

    if (linkError) {
      console.warn("[create-client-account] Liaison patient existant échouée:", linkError.message);
    } else {
      console.log("[create-client-account] Patient existant lié pour:", lookupEmail);
    }

    // ── Option B: create a fresh patient record (direct registration) ─────
    // Requires: ALTER TABLE patients ALTER COLUMN sophrologue_id DROP NOT NULL;
    if (create_patient_record) {
      const { error: insertError } = await supabase
        .from("patients")
        .insert({
          user_id: userId,
          email: normalisedEmail,
          prenom: prenom?.trim() || null,
          nom: nom?.trim() || null,
          // sophrologue_id intentionally omitted — linked at first booking.
          // This requires sophrologue_id to be nullable in the DB schema.
          // Run: ALTER TABLE patients ALTER COLUMN sophrologue_id DROP NOT NULL;
        });

      if (insertError) {
        // Non-blocking: account is created regardless. Most likely cause is
        // sophrologue_id NOT NULL constraint — run the migration above.
        console.error(
          "[create-client-account] Création fiche patient échouée:",
          insertError.message,
          "→ Vérifiez que sophrologue_id est nullable (voir commentaire ci-dessus)",
        );
      } else {
        console.log("[create-client-account] Fiche patient créée pour:", normalisedEmail);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[create-client-account] Erreur inattendue:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
