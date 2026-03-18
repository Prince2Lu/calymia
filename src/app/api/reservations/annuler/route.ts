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

    // ── 3) Calculer le taux de remboursement ──────────────────────────────────
    const ratio = calcRefundRatio(seance.debut_at);

    // ── 4) Récupérer le paiement ──────────────────────────────────────────────
    const { data: paiement, error: paiementReadError } = await supabaseAdmin
      .from("paiements")
      .select("id, montant_total, stripe_payment_intent_id, statut")
      .eq("seance_id", seance_id)
      .eq("statut", "reussi")
      .maybeSingle<PaiementRow>();

    if (paiementReadError) {
      console.error("[annuler] Erreur lecture paiement:", paiementReadError);
    }

    let montantRembourse = 0;

    // ── 5) Remboursement Stripe si applicable ─────────────────────────────────
    if (ratio > 0 && paiement?.stripe_payment_intent_id) {
      montantRembourse =
        Math.round(paiement.montant_total * ratio * 100) / 100;
      const amountCents = Math.round(montantRembourse * 100);

      try {
        await stripe.refunds.create({
          payment_intent: paiement.stripe_payment_intent_id,
          amount: amountCents,
        });

        await supabaseAdmin
          .from("paiements")
          .update({ statut: "rembourse" })
          .eq("id", paiement.id);

        console.log(
          `[annuler] Remboursement Stripe ${montantRembourse} € — séance ${seance_id} — par ${annule_par ?? "inconnu"}`,
        );
      } catch (stripeErr) {
        console.error("[annuler] Erreur remboursement Stripe:", stripeErr);
        return NextResponse.json(
          {
            error:
              "Le remboursement Stripe a échoué. La séance n'a pas été annulée.",
          },
          { status: 500 },
        );
      }
    }

    // ── 6) Marquer la séance comme annulée ────────────────────────────────────
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

    console.log(
      `[annuler] Séance ${seance_id} annulée par ${annule_par ?? "inconnu"} — remboursement ${montantRembourse} €`,
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
