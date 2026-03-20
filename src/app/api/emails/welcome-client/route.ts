import { NextRequest, NextResponse } from "next/server";
import { welcomeClient } from "@/lib/emails/templates";
import { sendEmail } from "@/lib/emails/send";

/**
 * POST { email, prenom? } — envoi email de bienvenue après création d’espace client (tunnel réservation).
 */
export async function POST(request: NextRequest) {
  try {
    const { email, prenom } = (await request.json()) as {
      email?: string;
      prenom?: string;
    };

    const to = email?.trim().toLowerCase();
    if (!to) {
      return NextResponse.json({ error: "email requis." }, { status: 400 });
    }

    const html = welcomeClient({
      prenom: (prenom?.trim() || "Client").replace(/</g, ""),
    });

    const result = await sendEmail({
      to,
      subject: "Bienvenue sur Calymia — votre espace client",
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
    console.error("[welcome-client] Erreur inattendue:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}
