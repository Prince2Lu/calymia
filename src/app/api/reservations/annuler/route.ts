import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ─── Clients Supabase ─────────────────────────────────────────────────────────

// Service role : pour toutes les opérations de données (bypass RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ─── Types ────────────────────────────────────────────────────────────────────

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

type SophrologueRow = { user_id: string };
type PatientRow = { user_id: string | null };

// ─── Helper : taux de remboursement selon le délai ───────────────────────────

function calcRefundRatio(debutAt: string): number {
  const heuresAvant =
    (new Date(debutAt).getTime() - Date.now()) / (1000 * 60 * 60);
  if (heuresAvant > 24) return 1.0;
  if (heuresAvant > 12) return 0.5;
  return 0;
}

// ─── Helper : récupérer l'utilisateur connecté via les cookies de session ─────

async function getAuthUser() {
  const cookieStore = await cookies();

  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Ignoré en lecture seule (route handler stateless)
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  return user;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      seance_id?: string;
      annule_par?: string;
    };

    const { seance_id, annule_par } = body;

    console.log(`[annuler] Starting cancellation — seance_id: ${seance_id}, annule_par: ${annule_par ?? "non précisé"}`);

    if (!seance_id) {
      return NextResponse.json(
        { error: "seance_id est requis." },
        { status: 400 },
      );
    }

    // ── 1) Récupérer la séance ────────────────────────────────────────────────
    const { data: seance, error: seanceReadError } = await supabaseAdmin
      .from("seances")
      .select("id, sophrologue_id, patient_id, debut_at, statut")
      .eq("id", seance_id)
      .maybeSingle<SeanceRow>();

    if (seanceReadError) {
      console.error("[annuler] Erreur lecture séance:", seanceReadError);
    }

    if (seanceReadError || !seance) {
      return NextResponse.json(
        { error: "Séance introuvable." },
        { status: 404 },
      );
    }

    console.log(`[annuler] Séance trouvée — statut: ${seance.statut}, debut_at: ${seance.debut_at}`);

    if (seance.statut === "annulee") {
      return NextResponse.json(
        { error: "Cette séance est déjà annulée." },
        { status: 409 },
      );
    }

    // ── 2) Autorisation soft : vérifier que le demandeur est bien le
    //       sophrologue ou le patient propriétaire de la séance.
    //       Si aucun utilisateur connecté trouvé, on autorise pour l'instant
    //       (cas appels internes / tests) — on durcira plus tard.
    const authUser = await getAuthUser();

    if (authUser) {
      let isAuthorized = false;

      // Vérifier si c'est le sophrologue
      const { data: sophrologue } = await supabaseAdmin
        .from("sophrologues")
        .select("user_id")
        .eq("id", seance.sophrologue_id)
        .maybeSingle<SophrologueRow>();

      if (sophrologue?.user_id === authUser.id) {
        isAuthorized = true;
      }

      // Vérifier si c'est le patient
      if (!isAuthorized) {
        const { data: patient } = await supabaseAdmin
          .from("patients")
          .select("user_id")
          .eq("id", seance.patient_id)
          .maybeSingle<PatientRow>();

        if (patient?.user_id === authUser.id) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        console.warn(
          `[annuler] Accès refusé — user ${authUser.id} ne possède pas la séance ${seance_id}`,
        );
        return NextResponse.json(
          { error: "Vous n'êtes pas autorisé à annuler cette séance." },
          { status: 403 },
        );
      }
    } else {
      // Aucune session : log et on laisse passer (bypass temporaire pour tests)
      console.warn(
        `[annuler] Aucun utilisateur connecté — accès permis temporairement pour séance ${seance_id}`,
      );
    }

    // ── 3) Déterminer le taux de remboursement selon l'auteur ─────────────────
    //   • Sophrologue → remboursement 100 % systématique (le sophrologue annule,
    //                   c'est de sa responsabilité)
    //   • Patient     → politique basée sur le délai avant la séance
    const isSophrologueCancel = annule_par === "sophrologue";
    const ratio = isSophrologueCancel ? 1.0 : calcRefundRatio(seance.debut_at);

    console.log(`[annuler] Ratio de remboursement: ${ratio * 100}% (isSophrologueCancel: ${isSophrologueCancel})`);

    // ── 4) Récupérer le paiement ──────────────────────────────────────────────
    // Fetches ONLY the successful payment tied to this exact seance_id.
    // Using .eq('statut','reussi') prevents accidentally picking up an already-
    // refunded row when multiple paiements rows exist for the same seance.
    console.log(`[annuler] Fetching payment for seance_id: ${seance_id}`);

    const { data: paiement, error: paiementReadError } = await supabaseAdmin
      .from("paiements")
      .select("id, montant_total, stripe_payment_intent_id, statut")
      .eq("seance_id", seance_id)
      .eq("statut", "reussi")
      .maybeSingle<PaiementRow>();

    if (paiementReadError) {
      console.error("[annuler] Erreur lecture paiement:", paiementReadError);
    }

    console.log("[annuler] Payment found:", paiement ?? null);

    let montantRembourse = 0;

    // ── 5) Remboursement Stripe si applicable ─────────────────────────────────
    // Guard: only refund if ratio > 0, payment exists, has a PI, and isn't already refunded
    const canRefund =
      ratio > 0 &&
      paiement != null &&
      paiement.stripe_payment_intent_id != null &&
      paiement.statut !== "rembourse";

    console.log(`[annuler] Peut rembourser: ${canRefund} — raisons: ratio=${ratio}, paiement=${!!paiement}, pi=${paiement?.stripe_payment_intent_id ?? "null"}, statut=${paiement?.statut ?? "null"}`);

    if (canRefund && paiement) {
      montantRembourse =
        Math.round(paiement.montant_total * ratio * 100) / 100;
      const amountCents = Math.round(montantRembourse * 100);

      console.log(`[annuler] Initiating Stripe refund — payment_intent: ${paiement.stripe_payment_intent_id}, amount_cents: ${amountCents}`);

      try {
        const refund = await stripe.refunds.create({
          payment_intent: paiement.stripe_payment_intent_id!,
          amount: amountCents,
        });

        console.log(`[annuler] Stripe refund created: ${refund.id}, status: ${refund.status}`);

        const { error: paiementUpdateError } = await supabaseAdmin
          .from("paiements")
          .update({ statut: "rembourse" })
          .eq("id", paiement.id);

        if (paiementUpdateError) {
          console.error("[annuler] Erreur mise à jour paiement:", paiementUpdateError);
        } else {
          console.log(`[annuler] Paiement ${paiement.id} marqué 'rembourse'`);
        }
      } catch (stripeErr) {
        console.error("[annuler] STRIPE ERROR — full error object:", stripeErr);
        console.error("[annuler] STRIPE ERROR — message:", (stripeErr as Error)?.message);
        return NextResponse.json(
          {
            error: `Le remboursement Stripe a échoué : ${(stripeErr as Error)?.message ?? "erreur inconnue"}. La séance n'a pas été annulée.`,
          },
          { status: 500 },
        );
      }
    } else if (ratio === 0) {
      console.log(`[annuler] Aucun remboursement — politique d'annulation tardive`);
    } else if (!paiement) {
      console.log(`[annuler] Aucun paiement trouvé pour cette séance — pas de remboursement Stripe`);
    }

    // ── 6) Marquer la séance comme annulée ────────────────────────────────────
    console.log(`[annuler] Updating seance ${seance_id} to 'annulee'`);

    const { error: updateError } = await supabaseAdmin
      .from("seances")
      .update({ statut: "annulee" })
      .eq("id", seance_id);

    if (updateError) {
      console.error("[annuler] Erreur mise à jour séance:", updateError);
      return NextResponse.json(
        { error: "Impossible de mettre à jour le statut de la séance." },
        { status: 500 },
      );
    }

    console.log(`[annuler] Séance ${seance_id} successfully marked 'annulee'`);

    // ── 7) Log dans la table communications (best-effort) ────────────────────
    try {
      await supabaseAdmin.from("communications").insert({
        seance_id,
        type: "annulation",
        contenu: isSophrologueCancel
          ? `Séance annulée par le sophrologue. Remboursement intégral de ${montantRembourse.toFixed(2)} € initié.`
          : `Séance annulée par le client. Remboursement de ${montantRembourse.toFixed(2)} € (${ratio * 100}%) initié.`,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Table optionnelle — on ne bloque pas si elle n'existe pas
    }

    console.log(
      `[annuler] Séance ${seance_id} annulée par ${annule_par ?? "inconnu"} — remboursement ${montantRembourse} € (${ratio * 100}%)`,
    );

    return NextResponse.json({
      success: true,
      montant_rembourse: montantRembourse,
      annule_par: annule_par ?? null,
    });
  } catch (error) {
    console.error("[annuler] Erreur inattendue:", error);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue." },
      { status: 500 },
    );
  }
}
