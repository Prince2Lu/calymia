import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Durée du blocage temporaire (alignée avec le cron cleanup) */
const HOLD_MINUTES = 15;

export async function POST(request: Request) {
  try {
    const { sophrologue_id, debut_at, fin_at, type_seance_id } = await request.json() as {
      sophrologue_id?: string | number;
      debut_at?: string;
      fin_at?: string;
      type_seance_id?: string | number;
    };

    if (!sophrologue_id || !debut_at || !fin_at || type_seance_id == null) {
      return NextResponse.json(
        { error: "sophrologue_id, debut_at, fin_at et type_seance_id sont requis." },
        { status: 400 },
      );
    }

    const { data: typeOk, error: typeErr } = await supabase
      .from("types_seances")
      .select("id")
      .eq("id", type_seance_id)
      .eq("sophrologue_id", sophrologue_id)
      .eq("actif", true)
      .maybeSingle();

    if (typeErr || !typeOk) {
      return NextResponse.json(
        { error: "Type de séance invalide ou inactif pour ce sophrologue." },
        { status: 400 },
      );
    }

    // ── Check: is the slot already taken by a non-expired seance? ────────────
    const { data: conflict } = await supabase
      .from("seances")
      .select("id")
      .eq("sophrologue_id", sophrologue_id)
      .in("statut", ["confirmee", "en_attente"])
      // overlap: existing.debut_at < fin_at AND existing.fin_at > debut_at
      .lt("debut_at", fin_at)
      .gt("fin_at", debut_at)
      // ignore expired temporary blocks
      .or(`expire_at.is.null,expire_at.gt.${new Date().toISOString()}`)
      .limit(1)
      .maybeSingle();

    if (conflict) {
      console.log("[bloquer-creneau] Conflit détecté pour slot:", debut_at, "seance:", conflict.id);
      return NextResponse.json(
        { error: "Ce créneau vient d'être réservé. Veuillez en choisir un autre." },
        { status: 409 },
      );
    }

    // ── Insert temporary block (NOW + 15 min, stocké en UTC / ISO Z) ────────
    const expireAt = new Date(
      Date.now() + HOLD_MINUTES * 60 * 1000,
    ).toISOString();

    const { data: seance, error: insertError } = await supabase
      .from("seances")
      .insert({
        sophrologue_id,
        type_seance_id,
        debut_at,
        fin_at,
        statut: "en_attente",
        origine: "en_ligne",
        expire_at: expireAt,
      })
      .select("id, expire_at")
      .single<{ id: string | number; expire_at: string | null }>();

    if (insertError || !seance) {
      console.error("[bloquer-creneau] Insert error:", insertError);
      return NextResponse.json(
        { error: "Impossible de bloquer le créneau. Merci de réessayer." },
        { status: 500 },
      );
    }

    if (seance.expire_at == null) {
      console.error(
        "[bloquer-creneau] expire_at absent après insert — vérifiez la colonne / triggers BDD",
        seance.id,
      );
      return NextResponse.json(
        { error: "Impossible de bloquer le créneau. Merci de réessayer." },
        { status: 500 },
      );
    }

    console.log("[bloquer-creneau] Créneau bloqué:", seance.id, "jusqu'à", expireAt);
    return NextResponse.json({ seance_id: seance.id, expire_at: expireAt });
  } catch (err) {
    console.error("[bloquer-creneau] Erreur inattendue:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
