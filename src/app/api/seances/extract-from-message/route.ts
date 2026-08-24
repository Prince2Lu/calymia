import { NextResponse } from "next/server";
import { getSophrologueSession } from "@/lib/auth/sophrologue-session";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { extractSeanceFromMessage } from "@/lib/ai/extract-seance-from-message";

export async function POST(request: Request) {
  try {
    const session = await getSophrologueSession();
    if (!session?.sophrologue) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    let body: { message?: unknown };
    try {
      body = (await request.json()) as { message?: unknown };
    } catch {
      return NextResponse.json(
        { ok: false, error: "Requête invalide." },
        { status: 400 },
      );
    }

    const message = typeof body.message === "string" ? body.message : "";
    const messageLen = message.trim().length;

    const supabase = getServiceRoleClient();
    const { data: typeRows, error: typeErr } = await supabase
      .from("types_seances")
      .select("id, nom")
      .eq("sophrologue_id", session.sophrologue.id)
      .eq("actif", true)
      .order("nom");

    if (typeErr) {
      console.error(
        "[extract-from-message] types_seances",
        typeErr.message,
        "len=",
        messageLen,
      );
      return NextResponse.json(
        {
          ok: false,
          error: "Impossible de charger vos types de séances. Réessayez.",
        },
        { status: 500 },
      );
    }

    const typesSeances = (typeRows ?? []).map((row) => ({
      id: String(row.id),
      nom: typeof row.nom === "string" ? row.nom : "Séance",
    }));

    const result = await extractSeanceFromMessage(
      message,
      typesSeances,
      new Date().toISOString(),
    );

    if (!result.ok) {
      console.error("[extract-from-message] échec", "len=", messageLen);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error(
      "[extract-from-message]",
      err instanceof Error ? err.name : "unknown",
    );
    return NextResponse.json(
      {
        ok: false,
        error: "Erreur interne. Réessayez ou remplissez le formulaire manuellement.",
      },
      { status: 500 },
    );
  }
}
