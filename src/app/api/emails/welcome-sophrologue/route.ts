import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { welcomeSophrologue } from "@/lib/emails/templates";
import { sendEmail } from "@/lib/emails/send";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const { sophrologue_id } = (await request.json()) as { sophrologue_id?: string };

    if (!sophrologue_id) {
      return NextResponse.json(
        { error: "sophrologue_id requis." },
        { status: 400 },
      );
    }

    const { data: sophrologue, error } = await supabase
      .from("sophrologues")
      .select("prenom, email")
      .eq("id", sophrologue_id)
      .single();

    if (error || !sophrologue) {
      return NextResponse.json(
        { error: "Sophrologue introuvable." },
        { status: 404 },
      );
    }

    const email = sophrologue.email ?? null;
    if (!email) {
      return NextResponse.json(
        { error: "Aucun email associé à ce sophrologue." },
        { status: 400 },
      );
    }

    const html = welcomeSophrologue({
      prenom: sophrologue.prenom ?? "Sophrologue",
    });

    const result = await sendEmail({
      to: email,
      subject: "Bienvenue sur Calymia",
      html,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Échec d'envoi de l'email." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[welcome-sophrologue] Erreur inattendue:", err);
    return NextResponse.json(
      { error: "Erreur interne." },
      { status: 500 },
    );
  }
}
