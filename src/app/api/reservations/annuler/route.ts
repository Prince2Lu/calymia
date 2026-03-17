import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type SeanceRow = {
  id: string;
  sophrologue_id: string;
  patient_id: string;
  debut_at: string;
  statut: string;
};

type PaiementRow = {
  id: string;
  montant_total: number;
  stripe_payment_intent_id: string | null;
  statut: string;
};

function calcRefundRatio(debutAt: string): number {
  const now = Date.now();
  const debut = new Date(debutAt).getTime();
  const heuresAvant = (debut - now) / (1000 * 60 * 60);

  if (heuresAvant > 24) return 1.0;
  if (heuresAvant > 12) return 0.5;
  return 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      seance_id?: string;
      annule_par?: string;
    };

    const { seance_id } = body;

    if (!seance_id) {
      return NextResponse.json(
        { error: "seance_id est requis." },
        { status: 400 },
      );
    }

    // 1) Récupérer la séance
    const { data: seance, error: seanceReadError } = await supabase
      .from("seances")
      .select("id, sophrologue_id, patient_id, debut_at, statut")
      .eq("id", seance_id)
      .maybeSingle<SeanceRow>();

    if (seanceReadError || !seance) {
      return NextResponse.json(
        { error: "Séance introuvable." },
        { status: 404 },
      );
    }

    if (seance.statut === "annulee") {
      return NextResponse.json(
        { error: "Cette séance est déjà annulée." },
        { status: 409 },
      );
    }

    // 2) Calculer le ratio de remboursement selon le délai
    const ratio = calcRefundRatio(seance.debut_at);

    // 3) Récupérer le paiement associé
    const { data: paiement, error: paiementReadError } = await supabase
      .from("paiements")
      .select("id, montant_total, stripe_payment_intent_id, statut")
      .eq("seance_id", seance_id)
      .eq("statut", "reussi")
      .maybeSingle<PaiementRow>();

    if (paiementReadError) {
      console.error("Annulation - paiement read error:", paiementReadError);
    }

    let montantRembourse = 0;

    // 4) Émettre un remboursement Stripe si applicable
    if (ratio > 0 && paiement?.stripe_payment_intent_id) {
      montantRembourse =
        Math.round(paiement.montant_total * ratio * 100) / 100;
      const amountCents = Math.round(montantRembourse * 100);

      try {
        await stripe.refunds.create({
          payment_intent: paiement.stripe_payment_intent_id,
          amount: amountCents,
        });

        await supabase
          .from("paiements")
          .update({ statut: "rembourse" })
          .eq("id", paiement.id);
      } catch (stripeErr) {
        console.error("Annulation - Stripe refund error:", stripeErr);
        return NextResponse.json(
          {
            error:
              "Le remboursement Stripe a échoué. La séance n'a pas été annulée.",
          },
          { status: 500 },
        );
      }
    }

    // 5) Marquer la séance comme annulée
    const { error: updateError } = await supabase
      .from("seances")
      .update({ statut: "annulee" })
      .eq("id", seance_id);

    if (updateError) {
      console.error("Annulation - seance update error:", updateError);
      return NextResponse.json(
        { error: "Impossible de mettre à jour le statut de la séance." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, montant_rembourse: montantRembourse });
  } catch (error) {
    console.error("Annulation - unexpected error:", error);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue." },
      { status: 500 },
    );
  }
}
