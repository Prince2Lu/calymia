import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { planAllowsSeanceNotes } from "@/lib/email-templates/placeholders";

async function getSessionSupabase() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
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
            /* ignore */
          }
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function getSophrologueRow(
  supabase: Awaited<ReturnType<typeof getSessionSupabase>>["supabase"],
  userId: string,
) {
  const { data: row, error } = await supabase
    .from("sophrologues")
    .select("id, plan")
    .eq("user_id", userId)
    .maybeSingle<{ id: string; plan: string | null }>();

  if (error || !row) return null;
  return row;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ seanceId: string }> },
) {
  const { seanceId } = await context.params;
  const { supabase, user } = await getSessionSupabase();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const sophro = await getSophrologueRow(supabase, user.id);
  if (!sophro) {
    return NextResponse.json(
      { error: "Profil sophrologue introuvable." },
      { status: 403 },
    );
  }

  if (!planAllowsSeanceNotes(sophro.plan)) {
    return NextResponse.json(
      { error: "Fonctionnalité non disponible sur ce plan" },
      { status: 403 },
    );
  }

  const { data: seance, error: seanceErr } = await supabase
    .from("seances")
    .select("id, sophrologue_id")
    .eq("id", seanceId)
    .maybeSingle<{ id: string; sophrologue_id: string }>();

  if (seanceErr || !seance || seance.sophrologue_id !== sophro.id) {
    return NextResponse.json(
      { error: "Séance introuvable ou non autorisée." },
      { status: 404 },
    );
  }

  const { data: note, error: noteErr } = await supabase
    .from("seance_notes")
    .select("id, contenu_html, updated_at, created_at")
    .eq("seance_id", seanceId)
    .eq("sophrologue_id", sophro.id)
    .maybeSingle();

  if (noteErr) {
    return NextResponse.json({ error: noteErr.message }, { status: 500 });
  }

  return NextResponse.json({ note: note ?? null });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ seanceId: string }> },
) {
  const { seanceId } = await context.params;
  const { supabase, user } = await getSessionSupabase();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const sophro = await getSophrologueRow(supabase, user.id);
  if (!sophro) {
    return NextResponse.json(
      { error: "Profil sophrologue introuvable." },
      { status: 403 },
    );
  }

  if (!planAllowsSeanceNotes(sophro.plan)) {
    return NextResponse.json(
      { error: "Fonctionnalité non disponible sur ce plan" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const contenu_html =
    typeof (body as { contenu_html?: unknown }).contenu_html === "string"
      ? (body as { contenu_html: string }).contenu_html
      : null;

  if (contenu_html === null) {
    return NextResponse.json(
      { error: "contenu_html (string) requis." },
      { status: 400 },
    );
  }

  const { data: seance, error: seanceErr } = await supabase
    .from("seances")
    .select("id, sophrologue_id, patient_id")
    .eq("id", seanceId)
    .maybeSingle<{
      id: string;
      sophrologue_id: string;
      patient_id: string | null;
    }>();

  if (seanceErr || !seance || seance.sophrologue_id !== sophro.id) {
    return NextResponse.json(
      { error: "Séance introuvable ou non autorisée." },
      { status: 404 },
    );
  }

  if (!seance.patient_id) {
    return NextResponse.json(
      { error: "Séance sans patient lié." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  const { data: upserted, error: upErr } = await supabase
    .from("seance_notes")
    .upsert(
      {
        sophrologue_id: sophro.id,
        patient_id: seance.patient_id,
        seance_id: seanceId,
        contenu_html,
        updated_at: now,
      },
      { onConflict: "sophrologue_id,seance_id" },
    )
    .select("id, contenu_html, updated_at")
    .single();

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ note: upserted });
}
