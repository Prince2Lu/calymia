import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type DispoInput = {
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
  actif: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const { sophrologue_id, dispos, delai } = (await request.json()) as {
      sophrologue_id: string;
      dispos: DispoInput[];
      delai: number;
    };

    if (!sophrologue_id || !Array.isArray(dispos)) {
      return NextResponse.json(
        { error: "sophrologue_id et dispos sont requis." },
        { status: 400 },
      );
    }

    // DELETE then INSERT — évite le problème de contrainte unique manquante
    const { error: deleteError } = await supabase
      .from("disponibilites")
      .delete()
      .eq("sophrologue_id", sophrologue_id);

    if (deleteError) {
      console.error("[sophrologue/disponibilites] delete:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const rows = dispos.map((d) => ({
      sophrologue_id,
      jour_semaine: d.jour_semaine,
      heure_debut: d.heure_debut,
      heure_fin: d.heure_fin,
      actif: d.actif,
    }));

    const { error: insertError } = await supabase
      .from("disponibilites")
      .insert(rows);

    if (insertError) {
      console.error("[sophrologue/disponibilites] insert:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log(`[sophrologue/disponibilites] ${rows.length} lignes sauvegardées pour sophrologue ${sophrologue_id}`);

    // Upsert du délai dans parametres_cabinet
    if (delai != null) {
      // Essayer UPDATE d'abord, puis INSERT si aucune ligne trouvée
      const { data: existing } = await supabase
        .from("parametres_cabinet")
        .select("sophrologue_id")
        .eq("sophrologue_id", sophrologue_id)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from("parametres_cabinet")
          .update({ delai_min_reservation_heures: Number(delai) })
          .eq("sophrologue_id", sophrologue_id);

        if (updateError) {
          console.error("[sophrologue/disponibilites] update params:", updateError);
        }
      } else {
        const { error: insertParamError } = await supabase
          .from("parametres_cabinet")
          .insert({ sophrologue_id, delai_min_reservation_heures: Number(delai) });

        if (insertParamError) {
          console.error("[sophrologue/disponibilites] insert params:", insertParamError);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[sophrologue/disponibilites] inattendu:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
