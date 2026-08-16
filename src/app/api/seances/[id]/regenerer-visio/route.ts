import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createDailyRoom } from "@/lib/visio/daily";
import { upsertSeanceEvent } from "@/lib/google/calendar-sync";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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
            // Ignoré en lecture seule (route handler)
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

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: seanceId } = await context.params;
    if (!seanceId) {
      return NextResponse.json({ error: "id séance manquant." }, { status: 400 });
    }

    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { data: sophrologue, error: sophError } = await supabaseAdmin
      .from("sophrologues")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle<{ id: string }>();

    if (sophError || !sophrologue) {
      return NextResponse.json(
        { error: "Compte sophrologue introuvable." },
        { status: 403 },
      );
    }

    const { data: seance, error: seanceError } = await supabaseAdmin
      .from("seances")
      .select(
        `id, fin_at, sophrologue_id, type_seance:types_seances(mode)`,
      )
      .eq("id", seanceId)
      .maybeSingle<{
        id: string;
        fin_at: string;
        sophrologue_id: string;
        type_seance: { mode: string | null } | { mode: string | null }[] | null;
      }>();

    if (seanceError || !seance) {
      return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });
    }

    if (seance.sophrologue_id !== sophrologue.id) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    const typeRow = Array.isArray(seance.type_seance)
      ? seance.type_seance[0]
      : seance.type_seance;
    if (typeRow?.mode !== "visio") {
      return NextResponse.json(
        { error: "Cette séance n’est pas en mode visio." },
        { status: 400 },
      );
    }

    let url: string;
    try {
      url = await createDailyRoom(seance.fin_at);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[regenerer-visio]", seanceId, message);
      const isMissingKey = message.includes("DAILY_API_KEY manquante");
      return NextResponse.json(
        {
          error: isMissingKey
            ? "DAILY_API_KEY manquante — configurez la clé Daily.co sur Vercel (DEV/PROD)."
            : `Échec Daily.co : ${message}`,
        },
        { status: 500 },
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("seances")
      .update({ lien_teleconsultation: url })
      .eq("id", seanceId)
      .eq("sophrologue_id", sophrologue.id);

    if (updateError) {
      console.error("[regenerer-visio] update:", updateError);
      return NextResponse.json(
        { error: "Impossible d’enregistrer le lien visio." },
        { status: 500 },
      );
    }

    try {
      await upsertSeanceEvent(seanceId);
    } catch (googleErr) {
      console.error("[regenerer-visio] Google Agenda:", googleErr);
    }

    return NextResponse.json({ lien_teleconsultation: url });
  } catch (err) {
    console.error("[regenerer-visio] inattendu:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
