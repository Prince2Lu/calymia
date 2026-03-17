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
      userId,
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
      bio?: string;
      specialties?: string[];
      rpps?: string;
      teleconsultationUrl?: string;
      address?: string;
      city?: string;
      postalCode?: string;
      phone?: string;
    };

    if (!userId) {
      return NextResponse.json(
        { error: "Utilisateur non identifié pour la mise à jour." },
        { status: 400 },
      );
    }

    console.log("Update called for userId:", userId);

    const { error } = await supabase
      .from("sophrologues")
      .update({
        bio,
        specialites: specialties,
        numero_rpps: rpps,
        lien_teleconsultation: teleconsultationUrl,
        adresse: address,
        ville: city,
        code_postal: postalCode,
        telephone: phone,
      })
      .eq("user_id", userId);

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json(
        {
          error:
            "Erreur lors de la mise à jour de votre profil. Merci de réessayer.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sophrologue update - unexpected exception:", error);
    return NextResponse.json(
      {
        error:
          "Une erreur inattendue est survenue lors de la mise à jour de votre profil.",
      },
      { status: 500 },
    );
  }
}

