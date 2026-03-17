import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type SeanceRow = {
  id: string;
  sophrologue_id: string;
  patient_id: string;
  debut_at: string;
  fin_at: string;
  statut: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      seance_id?: string;
      nouveau_debut_at?: string;
      reporte_par?: string;
    };

    const { seance_id, nouveau_debut_at, reporte_par } = body;

    if (!seance_id || !nouveau_debut_at) {
      return NextResponse.json(
        { error: "seance_id et nouveau_debut_at sont requis." },
        { status: 400 },
      );
    }

    const nouveauDebut = new Date(nouveau_debut_at);
    if (isNaN(nouveauDebut.getTime())) {
      return NextResponse.json(
        { error: "nouveau_debut_at n'est pas une date valide." },
        { status: 400 },
      );
    }

    if (nouveauDebut <= new Date()) {
      return NextResponse.json(
        { error: "Le nouveau créneau doit être dans le futur." },
        { status: 400 },
      );
    }

    // 1) Récupérer la séance à reporter
    const { data: seance, error: seanceReadError } = await supabase
      .from("seances")
      .select("id, sophrologue_id, patient_id, debut_at, fin_at, statut")
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
        { error: "Impossible de reporter une séance annulée." },
        { status: 409 },
      );
    }

    if (seance.statut === "confirmee" || seance.statut === "en_attente") {
      // OK — on peut reporter
    } else {
      return NextResponse.json(
        { error: `Impossible de reporter une séance avec le statut "${seance.statut}".` },
        { status: 409 },
      );
    }

    // Vérification d'autorisation si reporte_par est fourni
    if (
      reporte_par &&
      reporte_par !== seance.sophrologue_id &&
      reporte_par !== seance.patient_id
    ) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à reporter cette séance." },
        { status: 403 },
      );
    }

    // 2) Calculer la durée originale pour conserver la même durée
    const ancienDebut = new Date(seance.debut_at).getTime();
    const ancienFin = new Date(seance.fin_at).getTime();
    const dureeMs = ancienFin - ancienDebut;

    const nouveauFin = new Date(nouveauDebut.getTime() + dureeMs);

    // 3) Vérifier qu'aucune autre séance n'occupe ce créneau pour ce sophrologue
    const { data: conflit } = await supabase
      .from("seances")
      .select("id")
      .eq("sophrologue_id", seance.sophrologue_id)
      .neq("id", seance_id)
      .neq("statut", "annulee")
      .lt("debut_at", nouveauFin.toISOString())
      .gt("fin_at", nouveauDebut.toISOString())
      .maybeSingle<{ id: string }>();

    if (conflit) {
      return NextResponse.json(
        { error: "Ce créneau est déjà occupé. Merci d'en choisir un autre." },
        { status: 409 },
      );
    }

    // 4) Mettre à jour les horaires
    const { error: updateError } = await supabase
      .from("seances")
      .update({
        debut_at: nouveauDebut.toISOString(),
        fin_at: nouveauFin.toISOString(),
      })
      .eq("id", seance_id);

    if (updateError) {
      console.error("Reporter - seance update error:", updateError);
      return NextResponse.json(
        { error: "Impossible de reporter la séance. Merci de réessayer." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reporter - unexpected error:", error);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue." },
      { status: 500 },
    );
  }
}
