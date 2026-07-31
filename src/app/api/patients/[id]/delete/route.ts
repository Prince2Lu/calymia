import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type PatientRow = {
  id: string;
  sophrologue_id: string | null;
  prenom: string | null;
  nom: string | null;
};

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Ignoré en lecture seule (route handler stateless)
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  return user;
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: patientId } = await context.params;
    if (!patientId) {
      return NextResponse.json({ error: "id patient manquant." }, { status: 400 });
    }

    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { data: sophrologue, error: sophError } = await supabaseAdmin
      .from("sophrologues")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle<{ id: string }>();

    if (sophError || !sophrologue) {
      return NextResponse.json(
        { error: "Compte sophrologue introuvable." },
        { status: 403 },
      );
    }

    const { data: patient, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("id, sophrologue_id, prenom, nom")
      .eq("id", patientId)
      .maybeSingle<PatientRow>();

    if (patientError || !patient) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    }

    if (patient.sophrologue_id !== sophrologue.id) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à supprimer ce client." },
        { status: 403 },
      );
    }

    const nowIso = new Date().toISOString();
    const { data: futureSeances, error: futureError } = await supabaseAdmin
      .from("seances")
      .select("id")
      .eq("patient_id", patientId)
      .gt("debut_at", nowIso)
      .neq("statut", "annulee")
      .limit(1);

    if (futureError) {
      console.error("[patients/delete] lecture séances futures:", futureError);
      return NextResponse.json(
        { error: "Impossible de vérifier les séances à venir." },
        { status: 500 },
      );
    }

    if (futureSeances && futureSeances.length > 0) {
      return NextResponse.json(
        {
          error:
            "Impossible de supprimer ce client : des séances à venir non annulées existent. Annulez-les d'abord.",
          code: "FUTURE_SEANCES",
        },
        { status: 409 },
      );
    }

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      "delete_patient_cascade",
      { p_patient_id: patientId },
    );

    if (rpcError) {
      console.error("[patients/delete] rpc:", rpcError);
      return NextResponse.json(
        { error: "Échec suppression du client." },
        { status: 500 },
      );
    }

    const seancesSupprimees =
      typeof rpcResult === "object" &&
      rpcResult !== null &&
      "seances_supprimees" in rpcResult
        ? Number((rpcResult as { seances_supprimees: number }).seances_supprimees)
        : 0;

    console.log("[patients/delete] OK", {
      patientId,
      sophrologueId: sophrologue.id,
      seancesSupprimees,
    });

    return NextResponse.json({
      success: true,
      seances_supprimees: seancesSupprimees,
    });
  } catch (err) {
    console.error("[patients/delete] Erreur inattendue:", err);
    return NextResponse.json(
      { error: "Erreur interne du serveur." },
      { status: 500 },
    );
  }
}
