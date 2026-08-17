import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

export type BillingPlan = "essentiel" | "professionnel" | "cabinet";

export const TRIAL_DURATION_DAYS = 14;

let cachedPriceIdToPlan: Record<string, BillingPlan> | null = null;

/**
 * price_id Stripe → plan. Lu à l'appel (env DEV vs PROD), jamais au chargement du module.
 * Les clés vides sont ignorées (cabinet peut rester non configuré).
 */
export function getPriceIdToPlan(): Record<string, BillingPlan> {
  if (cachedPriceIdToPlan) return cachedPriceIdToPlan;

  const map: Record<string, BillingPlan> = {};
  const essentiel = process.env.STRIPE_PRICE_ESSENTIEL?.trim();
  const professionnel = process.env.STRIPE_PRICE_PROFESSIONNEL?.trim();
  const cabinet = process.env.STRIPE_PRICE_CABINET?.trim();

  if (essentiel) map[essentiel] = "essentiel";
  if (professionnel) map[professionnel] = "professionnel";
  if (cabinet) map[cabinet] = "cabinet";

  cachedPriceIdToPlan = map;
  return cachedPriceIdToPlan;
}

type CreateStripeCustomerForSophrologueInput = {
  supabaseAdmin: SupabaseClient;
  sophrologueId: string;
  email: string;
  prenom: string;
  nom: string;
};

export async function createStripeCustomerForSophrologue({
  supabaseAdmin,
  sophrologueId,
  email,
  prenom,
  nom,
}: CreateStripeCustomerForSophrologueInput) {
  console.log("[Billing] createStripeCustomerForSophrologue - start", {
    sophrologueId,
    email,
  });
  const fullName = [prenom, nom].filter(Boolean).join(" ").trim();

  const customer = await stripe.customers.create({
    email,
    name: fullName || undefined,
    preferred_locales: ["fr"],
    metadata: {
      sophrologue_id: sophrologueId,
    },
  });
  console.log("[Billing] customer Stripe créé", {
    sophrologueId,
    stripeCustomerId: customer.id,
  });

  const professionnelPriceId = process.env.STRIPE_PRICE_PROFESSIONNEL;
  if (!professionnelPriceId) {
    throw new Error("STRIPE_PRICE_PROFESSIONNEL est manquante côté serveur.");
  }

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: professionnelPriceId }],
    trial_period_days: TRIAL_DURATION_DAYS,
    payment_settings: { save_default_payment_method: "on_subscription" },
    trial_settings: { end_behavior: { missing_payment_method: "pause" } },
    metadata: {
      sophrologue_id: sophrologueId,
    },
  });

  console.log("[Billing] abonnement Stripe créé", {
    sophrologueId,
    stripeCustomerId: customer.id,
    subscriptionId: subscription.id,
    status: subscription.status,
  });

  const trialEndsAtIso = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : new Date(
        Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("sophrologues")
    .update({
      stripe_customer_id: customer.id,
      trial_ends_at: trialEndsAtIso,
      plan: "professionnel",
    })
    .eq("id", sophrologueId);

  if (updateError) {
    console.error("[Billing] échec update sophrologues", {
      sophrologueId,
      stripeCustomerId: customer.id,
      error: updateError.message,
    });
    throw new Error(
      `Impossible de sauvegarder le customer Stripe pour le sophrologue ${sophrologueId}: ${updateError.message}`,
    );
  }

  console.log("[Billing] update sophrologues OK", {
    sophrologueId,
    stripeCustomerId: customer.id,
    trialEndsAt: trialEndsAtIso,
  });

  return {
    stripeCustomerId: customer.id,
    trialEndsAt: trialEndsAtIso,
  };
}
