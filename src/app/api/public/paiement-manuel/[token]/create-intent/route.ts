import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { assertPrimaryCalendarSlotAvailable } from "@/lib/google/freebusy";
import { resolvePaiementManuelByToken } from "@/lib/booking/paiement-manuel";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const resolved = await resolvePaiementManuelByToken(token ?? "");

    if (resolved.statut === "introuvable") {
      return NextResponse.json({ error: "Lien invalide." }, { status: 404 });
    }
    if (resolved.statut === "deja_paye") {
      return NextResponse.json(
        { error: "Cette séance a déjà été confirmée." },
        { status: 409 },
      );
    }
    if (resolved.statut === "expire") {
      return NextResponse.json(
        { error: "Ce lien de paiement a expiré." },
        { status: 410 },
      );
    }

    const seanceId = resolved.seance_id;
    const sophrologueId = resolved.sophrologue_id;
    const typeSeanceId = resolved.type_seance_id;
    const patientId = resolved.patient_id;
    const debutAt = resolved.debut_at;
    const finAt = resolved.fin_at;

    if (
      !seanceId ||
      !sophrologueId ||
      !typeSeanceId ||
      !patientId ||
      !debutAt ||
      !finAt
    ) {
      return NextResponse.json(
        { error: "Séance incomplète, impossible d'initialiser le paiement." },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();
    const { data: typeRow, error: typeErr } = await supabase
      .from("types_seances")
      .select("id, tarif, sophrologue_id")
      .eq("id", typeSeanceId)
      .eq("sophrologue_id", sophrologueId)
      .maybeSingle<{ id: string; tarif: number; sophrologue_id: string }>();

    if (typeErr || !typeRow) {
      return NextResponse.json(
        { error: "Type de séance introuvable." },
        { status: 400 },
      );
    }

    const tarifEuros = Number(typeRow.tarif);
    if (!Number.isFinite(tarifEuros) || tarifEuros < 0) {
      console.error("[paiement-manuel create-intent] tarif invalide:", typeRow.tarif);
      return NextResponse.json(
        { error: "Tarif de la séance invalide." },
        { status: 500 },
      );
    }

    const googleCheck = await assertPrimaryCalendarSlotAvailable(
      sophrologueId,
      new Date(debutAt),
      new Date(finAt),
    );
    if (!googleCheck.ok) {
      return NextResponse.json(
        { error: googleCheck.error },
        { status: googleCheck.httpStatus },
      );
    }

    const amountCents = Math.round(tarifEuros * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "eur",
      metadata: {
        seance_id: String(seanceId),
        sophrologue_id: String(sophrologueId),
        patient_id: String(patientId),
        type_seance_id: String(typeSeanceId),
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

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      seance_id: seanceId,
      amount: tarifEuros,
    });
  } catch (err) {
    console.error("[paiement-manuel create-intent]", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
