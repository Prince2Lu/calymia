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

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature Stripe manquante." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(rawBody, "utf8"),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Signature Stripe invalide." }, { status: 400 });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const seanceId = pi.metadata?.seance_id;
      const sophrologueId = pi.metadata?.sophrologue_id;
      const patientId = pi.metadata?.patient_id;

      if (!seanceId) {
        console.error("Webhook: missing seance_id in metadata", pi.metadata);
        return NextResponse.json({ received: true });
      }

      const { error: updateError } = await supabase
        .from("seances")
        .update({ statut: "confirmee" })
        .eq("id", seanceId);

      if (updateError) {
        console.error("Webhook: failed to update seance status", updateError);
      }

      const amountTotal = (pi.amount_received || pi.amount || 0) / 100;
      const commission = Math.round(amountTotal * 0.03 * 100) / 100;
      const montantSophrologue = Math.round((amountTotal - commission) * 100) / 100;

      const { error: paymentError } = await supabase.from("paiements").insert({
        seance_id: seanceId,
        sophrologue_id: sophrologueId,
        patient_id: patientId,
        montant_total: amountTotal,
        commission_calymia: commission,
        montant_sophrologue: montantSophrologue,
        statut: "reussi",
        stripe_payment_intent_id: pi.id,
      });

      if (paymentError) {
        console.error("Webhook: failed to insert paiement", paymentError);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Erreur webhook." }, { status: 500 });
  }
}

