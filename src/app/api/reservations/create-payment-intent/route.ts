import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { fetchAuthUserIdByEmail } from "@/lib/supabase/fetch-auth-user-id-by-email";
import { checkEtNotifierDepassementLimite } from "@/lib/notifications/limite-clients-alerte";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type Payload = {
  seance_id: string | number;
  sophrologue_id: string | number;
  /** Doit correspondre au type déjà posé sur la séance (bloquer-creneau). Le tarif est lu en BDD. */
  type_seance_id: string | number;
  debut_at: string;
  patient_prenom: string;
  patient_nom: string;
  patient_email: string;
  patient_telephone: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Payload>;

    const {
      seance_id,
      sophrologue_id,
      type_seance_id,
      debut_at,
      patient_prenom,
      patient_nom,
      patient_email,
      patient_telephone,
    } = body;

    const patientEmailNorm = patient_email?.trim().toLowerCase() ?? "";

    if (
      seance_id == null ||
      sophrologue_id == null ||
      type_seance_id == null ||
      !debut_at ||
      !patient_prenom ||
      !patient_nom ||
      !patient_email ||
      !patient_telephone
    ) {
      return NextResponse.json(
        { error: "Données invalides pour créer le paiement." },
        { status: 400 },
      );
    }

    // ── 0) Vérifier la séance + type — montant = tarif BDD (pas le client) ─────
    const { data: seanceRow, error: seanceReadErr } = await supabase
      .from("seances")
      .select("id, sophrologue_id, type_seance_id, statut")
      .eq("id", seance_id)
      .maybeSingle<{
        id: string;
        sophrologue_id: string | number;
        type_seance_id: string | number | null;
        statut: string;
      }>();

    if (seanceReadErr || !seanceRow) {
      console.error("Create PI - séance introuvable:", seanceReadErr);
      return NextResponse.json(
        { error: "Séance introuvable." },
        { status: 404 },
      );
    }

    if (String(seanceRow.sophrologue_id) !== String(sophrologue_id)) {
      return NextResponse.json({ error: "Sophrologue incorrect." }, { status: 400 });
    }

    if (seanceRow.statut !== "en_attente") {
      return NextResponse.json(
        { error: "Cette séance n'est plus en attente de paiement." },
        { status: 400 },
      );
    }

    if (
      seanceRow.type_seance_id == null ||
      String(seanceRow.type_seance_id) !== String(type_seance_id)
    ) {
      return NextResponse.json(
        { error: "Le type de séance ne correspond pas au créneau réservé." },
        { status: 400 },
      );
    }

    const { data: typeRow, error: typeReadErr } = await supabase
      .from("types_seances")
      .select("id, tarif, actif, sophrologue_id")
      .eq("id", type_seance_id)
      .eq("sophrologue_id", sophrologue_id)
      .maybeSingle<{ id: string; tarif: number; actif: boolean; sophrologue_id: string | number }>();

    if (typeReadErr || !typeRow || !typeRow.actif) {
      return NextResponse.json(
        { error: "Type de séance introuvable ou inactif." },
        { status: 400 },
      );
    }

    const tarifEuros = Number(typeRow.tarif);
    if (!Number.isFinite(tarifEuros) || tarifEuros < 0) {
      console.error("Create PI - tarif invalide:", typeRow.tarif);
      return NextResponse.json(
        { error: "Tarif de la séance invalide." },
        { status: 500 },
      );
    }

    const amountCents = Math.round(tarifEuros * 100);

    // ── 1) Récupérer ou créer le client (une fiche par couple email + sophrologue) ─
    // Même email chez un autre sophrologue ⇒ nouvelle ligne `patients` (multi-cabinet).
    let patient: { id: string | number } | null = null;
    let isNewPatient = false;

    const authUserId = await fetchAuthUserIdByEmail(patientEmailNorm);

    const { data: existing } = await supabase
      .from("patients")
      .select("id, user_id")
      .eq("sophrologue_id", sophrologue_id)
      .eq("email", patientEmailNorm)
      .maybeSingle<{ id: string | number; user_id: string | null }>();

    if (existing) {
      // On ne réécrit jamais prenom/nom/telephone d'une fiche existante :
      // seule la mise à jour "de complétion" (user_id manquant) reste possible.
      const patch: { user_id?: string } = {};
      if (!existing.user_id && authUserId) {
        patch.user_id = authUserId;
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from("patients").update(patch).eq("id", existing.id);
      }
      patient = { id: existing.id };
      console.log(
        "Create PI - client existant (même sophrologue + email) réutilisé:",
        patient.id,
      );
    } else {
      // Prefer canonical identity (sophrologue_id IS NULL) over form values
      // when the client already has an auth account + canonical patient row.
      let canonicalPrenom = patient_prenom;
      let canonicalNom = patient_nom;
      let canonicalTelephone = patient_telephone;

      if (authUserId) {
        const { data: canonical } = await supabase
          .from("patients")
          .select("prenom, nom, telephone")
          .eq("user_id", authUserId)
          .is("sophrologue_id", null)
          .maybeSingle<{
            prenom: string | null;
            nom: string | null;
            telephone: string | null;
          }>();

        if (canonical) {
          canonicalPrenom = canonical.prenom || patient_prenom;
          canonicalNom = canonical.nom || patient_nom;
          canonicalTelephone = canonical.telephone || patient_telephone;
        }
      }

      const { data: created, error: patientError } = await supabase
        .from("patients")
        .insert({
          sophrologue_id,
          prenom: canonicalPrenom,
          nom: canonicalNom,
          email: patientEmailNorm,
          telephone: canonicalTelephone,
          ...(authUserId ? { user_id: authUserId } : {}),
        })
        .select("id")
        .single<{ id: string | number }>();

      if (patientError || !created) {
        console.error("Create PI - patient insert error:", patientError);
        if (patientError?.code === "23505") {
          console.error(
            "Create PI — contrainte unique (souvent email global sur patients). Attendu : une fiche par (email, sophrologue_id).",
          );
        }
        return NextResponse.json(
          { error: "Impossible de créer le client. Merci de réessayer." },
          { status: 500 },
        );
      }
      patient = created;
      isNewPatient = true;
      console.log("Create PI - nouveau client créé (sophrologue):", patient.id);
    }

    // ── 2) Attach patient to the blocked seance, clear expire_at ─────────────
    const { error: seanceError } = await supabase
      .from("seances")
      .update({
        patient_id: patient.id,
        expire_at: null, // remove hold — slot is now a real pending booking
      })
      .eq("id", seance_id)
      .eq("statut", "en_attente"); // safety: don't touch confirmed seances

    if (seanceError) {
      console.error("Create PI - seance update error:", seanceError);
      return NextResponse.json(
        { error: "Impossible de lier la séance. Merci de réessayer." },
        { status: 500 },
      );
    }

    console.log("Create PI - séance liée au client:", seance_id, "→ patient:", patient.id);

    // ── 3) Créer le PaymentIntent Stripe (montant = tarif types_seances) ─────
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "eur",
      metadata: {
        seance_id: String(seance_id),
        sophrologue_id: String(sophrologue_id),
        patient_id: String(patient.id),
        type_seance_id: String(type_seance_id),
        tarif_euros: String(tarifEuros),
      },
      automatic_payment_methods: { enabled: true },
    });

    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        { error: "Impossible d'initialiser le paiement." },
        { status: 500 },
      );
    }

    // Alerte dépassement limite Essentiel — fire-and-forget strict
    // (ne doit jamais bloquer ni faire échouer la réponse paiement)
    if (isNewPatient) {
      void (async () => {
        try {
          await checkEtNotifierDepassementLimite(String(sophrologue_id));
        } catch (err) {
          console.error("Create PI - limite-clients (avalée):", err);
        }
      })();
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      seance_id,
    });
  } catch (error) {
    console.error("Create PI - unexpected error:", error);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue." },
      { status: 500 },
    );
  }
}
