import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type Payload = {
  // Existing blocked seance (from bloquer-creneau)
  seance_id: string | number;
  sophrologue_id: string | number;
  montant?: number;
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
      montant,
      debut_at,
      patient_prenom,
      patient_nom,
      patient_email,
      patient_telephone,
    } = body;

    if (
      seance_id == null ||
      sophrologue_id == null ||
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

    // ── 1) Récupérer ou créer le client (évite les doublons par email) ────────
    let patient: { id: string | number } | null = null;

    const { data: existing } = await supabase
      .from("patients")
      .select("id, user_id")
      .eq("sophrologue_id", sophrologue_id)
      .eq("email", patient_email)
      .maybeSingle<{ id: string | number; user_id: string | null }>();

    if (existing) {
      await supabase
        .from("patients")
        .update({ prenom: patient_prenom, nom: patient_nom, telephone: patient_telephone })
        .eq("id", existing.id);
      patient = { id: existing.id };
      console.log("Create PI - client existant réutilisé:", patient.id);
    } else {
      const { data: created, error: patientError } = await supabase
        .from("patients")
        .insert({
          sophrologue_id,
          prenom: patient_prenom,
          nom: patient_nom,
          email: patient_email,
          telephone: patient_telephone,
        })
        .select("id")
        .single<{ id: string | number }>();

      if (patientError || !created) {
        console.error("Create PI - patient insert error:", patientError);
        return NextResponse.json(
          { error: "Impossible de créer le client. Merci de réessayer." },
          { status: 500 },
        );
      }
      patient = created;
      console.log("Create PI - nouveau client créé:", patient.id);
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

    // ── 3) Créer le PaymentIntent Stripe ─────────────────────────────────────
    const amountCents = Math.round((montant ?? 60) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "eur",
      metadata: {
        seance_id: String(seance_id),
        sophrologue_id: String(sophrologue_id),
        patient_id: String(patient.id),
      },
      automatic_payment_methods: { enabled: true },
    });

    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        { error: "Impossible d'initialiser le paiement." },
        { status: 500 },
      );
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
