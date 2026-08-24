import { NextRequest, NextResponse } from "next/server";
import { getSophrologueSession } from "@/lib/auth/sophrologue-session";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { generateAndStoreRecu } from "@/lib/recus/generate";

export async function POST(request: NextRequest) {
  try {
    const session = await getSophrologueSession();
    if (!session?.sophrologue) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = (await request.json()) as { seance_id?: string };
    const { seance_id } = body;

    if (!seance_id) {
      return NextResponse.json(
        { error: "seance_id est requis." },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();
    const { data: seance } = await supabase
      .from("seances")
      .select("sophrologue_id")
      .eq("id", seance_id)
      .maybeSingle();

    if (!seance || seance.sophrologue_id !== session.sophrologue.id) {
      return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
    }

    const result = await generateAndStoreRecu(seance_id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      recu_url: result.recu_url,
    });
  } catch (error) {
    console.error("[POST /api/recus/generer]", error);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue." },
      { status: 500 },
    );
  }
}
