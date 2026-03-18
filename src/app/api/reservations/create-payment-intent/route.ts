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
  sophrologue_id: string | number;
  montant: number;
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
      sophrologue_id,
      montant,
      debut_at,
      patient_prenom,
      patient_nom,
      patient_email,
      patient_telephone,
    } = body;

    if (
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

    // 1) Récupérer ou créer le client (évite les doublons par email)
    let patient: { id: string | number } | null = null;

    const { data: existing } = await supabase
      .from("patients")
      .select("id, user_id")
      .eq("sophrologue_id", sophrologue_id)
      .eq("email", patient_email)
      .maybeSingle<{ id: string | number; user_id: string | null }>();

    if (existing) {
      // Client déjà connu — mettre à jour les infos de contact
      await supabase
        .from("patients")
        .update({
          prenom: patient_prenom,
          nom: patient_nom,
          telephone: patient_telephone,
        })
        .eq("id", existing.id);

      patient = { id: existing.id };
      console.log("Create PI - client existant réutilisé:", patient.id);
    } else {
      // Nouveau client
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

    // 2) Récupérer le type_seance_id (NOT NULL en base — obligatoire)
    //    Essai 1 : type actif du sophrologue
    let { data: typeSeance } = await supabase
      .from("types_seances")
      .select("id")
      .eq("sophrologue_id", sophrologue_id)
      .eq("actif", true)
      .limit(1)
      .maybeSingle<{ id: string | number }>();

    // Essai 2 : n'importe quel type du sophrologue (même inactif)
    if (typeSeance == null) {
      const { data: fallback } = await supabase
        .from("types_seances")
        .select("id")
        .eq("sophrologue_id", sophrologue_id)
        .limit(1)
        .maybeSingle<{ id: string | number }>();
      typeSeance = fallback;
    }

    if (typeSeance == null) {
      return NextResponse.json(
        {
          error:
            "Aucun type de séance configuré. Merci de créer au moins une séance dans vos paramètres avant de recevoir des réservations.",
        },
        { status: 400 },
      );
    }

    // 3) Calculer fin_at = debut_at + 60 min
    const debutDate = new Date(debut_at);
    const finDate = new Date(debutDate.getTime() + 60 * 60 * 1000);

    const seancePayload: Record<string, unknown> = {
      sophrologue_id,
      patient_id: patient.id,
      type_seance_id: typeSeance.id,
      debut_at,
      fin_at: finDate.toISOString(),
      statut: "en_attente",
      origine: "en_ligne",
    };

    const { data: seance, error: seanceError } = await supabase
      .from("seances")
      .insert(seancePayload)
      .select("id")
      .single<{ id: string | number }>();

    if (seanceError || !seance) {
      console.error("Create PI - seance insert error:", seanceError);
      return NextResponse.json(
        { error: "Impossible de créer la séance. Merci de réessayer." },
        { status: 500 },
      );
    }

    // 4) Créer le PaymentIntent Stripe
    const amountCents = Math.round((montant ?? 60) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "eur",
      metadata: {
        seance_id: String(seance.id),
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
      seance_id: seance.id,
    });
  } catch (error) {
    console.error("Create PI - unexpected error:", error);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue." },
      { status: 500 },
    );
  }
}
