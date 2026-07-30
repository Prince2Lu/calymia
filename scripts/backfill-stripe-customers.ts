/**
 * Backfill Stripe Billing customers for legacy sophrologue accounts (DEV only).
 *
 * Usage:
 *   npx tsx scripts/backfill-stripe-customers.ts          # dry-run (default)
 *   npx tsx scripts/backfill-stripe-customers.ts --apply  # create customers + trials
 *
 * Requires .env.local with DEV Supabase (cdfltpuzlkyoymjgdhcr) and Stripe TEST keys.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const DEV_PROJECT_REF = "cdfltpuzlkyoymjgdhcr";
const PROD_PROJECT_REF = "tsydrlqcshgnblgiacow";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    console.warn("[backfill] .env.local introuvable — variables d'environnement système uniquement.");
    return;
  }
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function assertDevSupabaseEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (.env.local DEV).",
    );
  }

  if (!supabaseUrl.includes(DEV_PROJECT_REF)) {
    throw new Error(
      `Refus : NEXT_PUBLIC_SUPABASE_URL ne pointe pas vers le projet DEV (${DEV_PROJECT_REF}). URL actuelle : ${supabaseUrl}`,
    );
  }

  if (supabaseUrl.includes(PROD_PROJECT_REF)) {
    throw new Error(
      `Refus : ce script ne doit jamais cibler PROD (${PROD_PROJECT_REF}).`,
    );
  }
}

function assertDevStripeEnvironment() {
  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  const stripePrice = process.env.STRIPE_PRICE_PROFESSIONNEL ?? "";

  if (!stripeKey) {
    throw new Error("STRIPE_SECRET_KEY est requis (.env.local DEV).");
  }

  if (stripeKey.startsWith("sk_live_")) {
    throw new Error(
      "Refus : STRIPE_SECRET_KEY est une clé LIVE (sk_live_). Utiliser les clés TEST DEV uniquement.",
    );
  }

  if (!stripePrice) {
    throw new Error(
      "STRIPE_PRICE_PROFESSIONNEL est requis pour créer les subscriptions trial.",
    );
  }
}

type SophrologueRow = {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  plan: string;
  stripe_customer_id: string | null;
};

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  return { apply };
}

function formatName(row: Pick<SophrologueRow, "prenom" | "nom">) {
  return [row.prenom, row.nom].filter(Boolean).join(" ").trim() || "—";
}

async function main() {
  loadEnvLocal();
  assertDevSupabaseEnvironment();

  const { apply } = parseArgs(process.argv.slice(2));

  if (apply) {
    assertDevStripeEnvironment();
  }

  const { createClient } = await import("@supabase/supabase-js");
  const { createStripeCustomerForSophrologue } = await import(
    "../src/lib/stripe/billing"
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  console.log("═".repeat(60));
  console.log("Backfill stripe_customer_id — Calymia DEV");
  console.log(`Mode : ${apply ? "APPLY (écriture Stripe + Supabase)" : "DRY-RUN (aucune modification)"}`);
  console.log(`Supabase : ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log("═".repeat(60));

  const { data: rows, error: listError } = await supabase
    .from("sophrologues")
    .select("id, email, prenom, nom, plan, stripe_customer_id")
    .is("stripe_customer_id", null)
    .order("created_at", { ascending: true });

  if (listError) {
    throw new Error(`Impossible de lister les sophrologues : ${listError.message}`);
  }

  const candidates = (rows ?? []) as SophrologueRow[];

  if (candidates.length === 0) {
    console.log("\nAucun sophrologue sans stripe_customer_id. Rien à faire.");
    return;
  }

  console.log(`\n${candidates.length} compte(s) sans stripe_customer_id :\n`);

  for (const row of candidates) {
    console.log(
      `  • id=${row.id} | email=${row.email} | nom=${formatName(row)} | plan=${row.plan}`,
    );
  }

  if (!apply) {
    console.log(
      "\nDry-run terminé. Relancer avec --apply pour créer les customers Stripe.",
    );
    return;
  }

  let processed = 0;
  let successes = 0;
  let failures = 0;

  console.log("\n── Application ──\n");

  for (const row of candidates) {
    processed += 1;

    const { data: current, error: fetchError } = await supabase
      .from("sophrologues")
      .select("id, stripe_customer_id")
      .eq("id", row.id)
      .maybeSingle<{ id: string; stripe_customer_id: string | null }>();

    if (fetchError) {
      failures += 1;
      console.error(
        `✗ ${formatName(row)} (${row.id}) — impossible de re-vérifier l'état : ${fetchError.message}`,
      );
      continue;
    }

    if (current?.stripe_customer_id) {
      console.log(
        `⊘ ${formatName(row)} (${row.id}) — stripe_customer_id déjà présent (${current.stripe_customer_id}), ignoré.`,
      );
      successes += 1;
      continue;
    }

    try {
      const result = await createStripeCustomerForSophrologue({
        supabaseAdmin: supabase,
        sophrologueId: row.id,
        email: row.email,
        prenom: row.prenom,
        nom: row.nom,
      });

      console.log(
        `✓ ${formatName(row)} (${row.id}) — customer=${result.stripeCustomerId} | trial_ends_at=${result.trialEndsAt}`,
      );
      successes += 1;
    } catch (err) {
      failures += 1;
      const message =
        err instanceof Error ? err.message : String(err);
      console.error(`✗ ${formatName(row)} (${row.id}) — ${message}`);
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log("Résumé");
  console.log(`  Comptes traités : ${processed}`);
  console.log(`  Succès          : ${successes}`);
  console.log(`  Échecs          : ${failures}`);
  console.log("═".repeat(60));

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("\n[backfill] Erreur fatale :", err instanceof Error ? err.message : err);
  process.exit(1);
});
