/**
 * ADMIN UTILITY — supprime les patients sans séances pour le compte de test.
 * Aucun body requis. À protéger avant mise en production.
 *
 * POST /api/admin/cleanup
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "eric@calymia.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST() {
  try {
    // 1) Trouver le sophrologue correspondant au compte de test
    const { data: sophrologue, error: sophroError } = await supabase
      .from("sophrologues")
      .select("id, prenom, nom")
      .eq("email", TEST_EMAIL)
      .maybeSingle<{ id: string; prenom: string | null; nom: string | null }>();

    if (sophroError || !sophrologue) {
      console.error("[admin/cleanup] Sophrologue introuvable pour", TEST_EMAIL, sophroError);
      return NextResponse.json(
        { error: `Aucun sophrologue trouvé pour l'email ${TEST_EMAIL}.` },
        { status: 404 },
      );
    }

    const sophrologueId = sophrologue.id;
    console.log(`[admin/cleanup] Sophrologue : ${sophrologue.prenom} ${sophrologue.nom} (${sophrologueId})`);

    // 2) Récupérer les patient_ids qui ont au moins une séance
    const { data: seances, error: seancesError } = await supabase
      .from("seances")
      .select("patient_id")
      .eq("sophrologue_id", sophrologueId);

    if (seancesError) {
      console.error("[admin/cleanup] Erreur lecture séances:", seancesError);
      return NextResponse.json({ error: seancesError.message }, { status: 500 });
    }

    const patientIdsWithSeances = [
      ...new Set((seances ?? []).map((s) => s.patient_id).filter(Boolean)),
    ] as string[];

    console.log(`[admin/cleanup] ${patientIdsWithSeances.length} patient(s) avec séances — conservés`);

    // 3) Supprimer les patients sans séances
    let deleteQuery = supabase
      .from("patients")
      .delete()
      .eq("sophrologue_id", sophrologueId);

    if (patientIdsWithSeances.length > 0) {
      deleteQuery = deleteQuery.not(
        "id",
        "in",
        `(${patientIdsWithSeances.join(",")})`,
      );
    }

    const { data: deleted, error: deleteError, count } = await deleteQuery.select("id, prenom, nom");

    if (deleteError) {
      console.error("[admin/cleanup] Erreur suppression:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const nbDeleted = deleted?.length ?? count ?? 0;
    console.log(`[admin/cleanup] ${nbDeleted} patient(s) supprimé(s)`);

    return NextResponse.json({
      success: true,
      deleted_count: nbDeleted,
      deleted_patients: deleted ?? [],
      kept_patient_ids: patientIdsWithSeances,
    });
  } catch (err) {
    console.error("[admin/cleanup] Erreur inattendue:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
