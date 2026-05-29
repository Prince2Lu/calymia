import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

type ModererAction = "approuver" | "rejeter";

type ModererBody = {
  avis_id: string;
  action: ModererAction;
};

const STATUT_BY_ACTION: Record<ModererAction, "approuve" | "rejete"> = {
  approuver: "approuve",
  rejeter: "rejete",
};

function parseBody(value: unknown): ModererBody | null {
  if (typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;
  const avisId = obj.avis_id;
  const action = obj.action;
  if (typeof avisId !== "string" || !avisId) return null;
  if (action !== "approuver" && action !== "rejeter") return null;
  return { avis_id: avisId, action };
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const supabaseAuth = await createServerSupabase();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: sophrologue } = await supabaseAuth
    .from("sophrologues")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();

  if (!sophrologue) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { data: avis, error: selectError } = await supabaseAuth
    .from("avis")
    .select("sophrologue_id")
    .eq("id", body.avis_id)
    .maybeSingle<{ sophrologue_id: string }>();

  if (selectError) {
    console.error("[avis/moderer] Erreur lecture avis:", selectError.message);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }

  if (!avis) {
    return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
  }

  if (avis.sophrologue_id !== sophrologue.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error: updateError } = await supabaseAdmin
    .from("avis")
    .update({
      statut: STATUT_BY_ACTION[body.action],
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.avis_id);

  if (updateError) {
    console.error("[avis/moderer] Erreur mise à jour avis:", updateError.message);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
