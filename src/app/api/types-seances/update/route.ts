import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const MODES_VALIDES = ["presentiel", "visio"] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: "id est requis." }, { status: 400 });
    }

    if ("mode" in fields) {
      if (
        typeof fields.mode !== "string" ||
        !(MODES_VALIDES as readonly string[]).includes(fields.mode)
      ) {
        return NextResponse.json(
          { error: "mode doit être 'presentiel' ou 'visio'." },
          { status: 400 },
        );
      }
    }

    const allowed = ["nom", "duree_minutes", "tarif", "actif", "mode"];
    const payload: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in fields) payload[key] = fields[key];
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour." }, { status: 400 });
    }

    const { error } = await supabase.from("types_seances").update(payload).eq("id", id);

    if (error) {
      console.error("[types-seances/update]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[types-seances/update] inattendu:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
