import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      userId,   // auth.users UUID — used in WHERE user_id = userId
      prenom,
      nom,
      bio,
      specialties,
      rpps,
      teleconsultationUrl,
      address,
      city,
      postalCode,
      phone,
    } = body as {
      userId?: string;
      prenom?: string;
      nom?: string;
      bio?: string;
      specialties?: string[];
      rpps?: string;
      teleconsultationUrl?: string;
      address?: string;
      city?: string;
      postalCode?: string;
      phone?: string;
    };

    console.log("[sophrologue/update] userId reçu :", userId);
    console.log("[sophrologue/update] payload complet :", {
      prenom, nom, bio, specialties, rpps,
      teleconsultationUrl, address, city, postalCode, phone,
    });

    if (!userId) {
      console.error("[sophrologue/update] userId manquant dans le body");
      return NextResponse.json(
        { error: "Utilisateur non identifié pour la mise à jour." },
        { status: 400 },
      );
    }

    const updatePayload = {
      ...(prenom !== undefined && { prenom }),
      ...(nom !== undefined && { nom }),
      ...(bio !== undefined && { bio }),
      ...(specialties !== undefined && { specialites: specialties }),
      ...(rpps !== undefined && { numero_rpps: rpps }),
      ...(teleconsultationUrl !== undefined && { lien_teleconsultation: teleconsultationUrl }),
      ...(address !== undefined && { adresse: address }),
      ...(city !== undefined && { ville: city }),
      ...(postalCode !== undefined && { code_postal: postalCode }),
      ...(phone !== undefined && { telephone: phone }),
    };

    console.log("[sophrologue/update] Colonnes mises à jour :", updatePayload);

    const { data, error } = await supabase
      .from("sophrologues")
      .update(updatePayload)
      .eq("user_id", userId)
      .select("id, user_id, prenom, nom");

    console.log("[sophrologue/update] Réponse Supabase — data :", data, "| error :", error);

    if (error) {
      console.error("[sophrologue/update] Erreur Supabase :", error);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour de votre profil. Merci de réessayer." },
        { status: 500 },
      );
    }

    if (!data || data.length === 0) {
      console.warn("[sophrologue/update] Aucune ligne mise à jour — user_id introuvable :", userId);
      return NextResponse.json(
        { error: "Profil introuvable pour cet utilisateur." },
        { status: 404 },
      );
    }

    console.log("[sophrologue/update] Succès — ligne mise à jour :", data[0]);
    return NextResponse.json({ success: true, sophrologue: data[0] });
  } catch (error) {
    console.error("[sophrologue/update] Exception inattendue :", error);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue lors de la mise à jour de votre profil." },
      { status: 500 },
    );
  }
}
