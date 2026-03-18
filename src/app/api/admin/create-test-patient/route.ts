/**
 * ADMIN UTILITY — crée un compte patient de test.
 * À utiliser uniquement en développement.
 *
 * POST /api/admin/create-test-patient
 * Body : { sophrologue_id: string }   (optionnel — si absent, cherche le 1er sophrologue)
 * Header : x-admin-key: <SUPABASE_SERVICE_ROLE_KEY>
 *
 * Retourne : { success, email, password, patient_id, user_id }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "patient.test@calymia.com";
const TEST_PASSWORD = "Test1234!";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    let sophrologueId: string | null = body.sophrologue_id ?? null;

    // Si pas de sophrologue_id fourni, prendre le premier disponible
    if (!sophrologueId) {
      const { data: sophrologue } = await supabase
        .from("sophrologues")
        .select("id, prenom, nom")
        .order("created_at")
        .limit(1)
        .maybeSingle<{ id: string; prenom: string | null; nom: string | null }>();

      if (!sophrologue) {
        return NextResponse.json(
          { error: "Aucun sophrologue trouvé en base. Créez d'abord un compte sophrologue." },
          { status: 422 },
        );
      }
      sophrologueId = sophrologue.id;
      console.log(`[admin/create-test-patient] Sophrologue cible : ${sophrologue.prenom} ${sophrologue.nom} (${sophrologueId})`);
    }

    // 1) Vérifier si le compte auth existe déjà
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === TEST_EMAIL);

    let authUserId: string;

    if (existingUser) {
      console.log(`[admin/create-test-patient] Compte auth existant trouvé : ${existingUser.id}`);
      authUserId = existingUser.id;

      // Mettre à jour le mot de passe au cas où
      await supabase.auth.admin.updateUserById(authUserId, {
        password: TEST_PASSWORD,
      });
    } else {
      // 2) Créer le compte auth Supabase
      const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true, // confirme immédiatement l'email
      });

      if (authError || !newUser.user) {
        console.error("[admin/create-test-patient] Erreur création auth:", authError);
        return NextResponse.json(
          { error: `Erreur création compte auth : ${authError?.message}` },
          { status: 500 },
        );
      }

      authUserId = newUser.user.id;
      console.log(`[admin/create-test-patient] Compte auth créé : ${authUserId}`);
    }

    // 3) Vérifier si la fiche patient existe déjà
    const { data: existingPatient } = await supabase
      .from("patients")
      .select("id")
      .eq("user_id", authUserId)
      .eq("sophrologue_id", sophrologueId)
      .maybeSingle<{ id: string }>();

    let patientId: string;

    if (existingPatient) {
      console.log(`[admin/create-test-patient] Fiche patient existante : ${existingPatient.id}`);
      patientId = existingPatient.id;
    } else {
      // 4) Créer la fiche patient liée
      const { data: patient, error: patientError } = await supabase
        .from("patients")
        .insert({
          sophrologue_id: sophrologueId,
          user_id: authUserId,
          prenom: "Patient",
          nom: "Test",
          email: TEST_EMAIL,
          telephone: "06 00 00 00 00",
        })
        .select("id")
        .single<{ id: string }>();

      if (patientError || !patient) {
        console.error("[admin/create-test-patient] Erreur création patient:", patientError);
        return NextResponse.json(
          { error: `Erreur création fiche patient : ${patientError?.message}` },
          { status: 500 },
        );
      }

      patientId = patient.id;
      console.log(`[admin/create-test-patient] Fiche patient créée : ${patientId}`);
    }

    return NextResponse.json({
      success: true,
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      user_id: authUserId,
      patient_id: patientId,
      sophrologue_id: sophrologueId,
    });
  } catch (err) {
    console.error("[admin/create-test-patient] Erreur inattendue:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
