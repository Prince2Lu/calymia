import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type SubmitAvisBody = {
  token: string;
  note: number;
  commentaire?: string;
};

type AvisRow = {
  id: string;
  token: string;
  token_utilise: boolean;
  token_expire_at: string;
};

function parseBody(value: unknown): SubmitAvisBody | null {
  if (typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;

  const token = obj.token;
  const note = obj.note;
  const commentaire = obj.commentaire;

  if (typeof token !== "string") return null;
  if (typeof note !== "number") return null;
  if (commentaire !== undefined && typeof commentaire !== "string") return null;

  return { token, note, commentaire };
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

  const token = body.token.trim();
  if (!token) {
    return NextResponse.json({ error: "Token manquant" }, { status: 400 });
  }

  if (
    !Number.isInteger(body.note) ||
    body.note < 1 ||
    body.note > 5
  ) {
    return NextResponse.json({ error: "Note invalide" }, { status: 400 });
  }

  const { data: avis, error: selectError } = await supabase
    .from("avis")
    .select("id, token, token_utilise, token_expire_at")
    .eq("token", token)
    .maybeSingle<AvisRow>();

  if (selectError) {
    console.error("[avis/submit] Erreur lecture avis:", selectError.message);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }

  if (!avis) {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  }

  if (avis.token_utilise) {
    return NextResponse.json(
      { error: "Vous avez déjà laissé un avis pour cette séance" },
      { status: 400 },
    );
  }

  if (new Date(avis.token_expire_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Ce lien a expiré" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("avis")
    .update({
      note: body.note,
      commentaire: body.commentaire ?? null,
      token_utilise: true,
      statut: "en_attente",
      updated_at: new Date().toISOString(),
    })
    .eq("token", token);

  if (updateError) {
    console.error("[avis/submit] Erreur mise à jour avis:", updateError.message);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
