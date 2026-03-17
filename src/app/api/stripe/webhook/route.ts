import { headers } from "next/headers";
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
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    console.error("Webhook: missing stripe-signature header");
    return new Response("Webhook Error: missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return new Response("Webhook Error: invalid signature", { status: 400 });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const { seance_id, sophrologue_id, patient_id } = pi.metadata ?? {};

      if (!seance_id) {
        console.error("Webhook: missing seance_id in metadata", pi.metadata);
        return new Response("OK", { status: 200 });
      }

      const { error: updateError } = await supabase
        .from("seances")
        .update({ statut: "confirmee" })
        .eq("id", seance_id);

      if (updateError) {
        console.error("Webhook: failed to update seance status", updateError);
      }

      const amountTotal = (pi.amount_received || pi.amount || 0) / 100;
      const commission = Math.round(amountTotal * 0.03 * 100) / 100;
      const montantSophrologue =
        Math.round((amountTotal - commission) * 100) / 100;

      const { error: paymentError } = await supabase.from("paiements").insert({
        seance_id,
        sophrologue_id,
        patient_id,
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

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return new Response("Webhook Error: internal error", { status: 500 });
  }
}
