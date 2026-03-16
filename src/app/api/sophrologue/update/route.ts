import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

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
      availability,
      sessionTypes,
      minBookingDelay,
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
      availability?: unknown;
      sessionTypes?: unknown;
      minBookingDelay?: string;
    };

    if (!userId) {
      return NextResponse.json(
        { error: "Utilisateur non identifié pour la mise à jour." },
        { status: 400 },
      );
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      {
        cookies: {
          get(name: string) {
            return undefined;
          },
          set(_name: string, _value: string, _options: CookieOptions) {
            // pas de gestion de cookies côté API pour cette route
          },
          remove(_name: string, _options: CookieOptions) {
            // pas de gestion de cookies côté API pour cette route
          },
        },
      },
    );

    const { error } = await supabase
      .from("sophrologues")
      .update({
        bio,
        specialties,
        rpps,
        teleconsultation_url: teleconsultationUrl,
        address,
        city,
        postal_code: postalCode,
        phone,
        availability,
        session_types: sessionTypes,
        min_booking_delay: minBookingDelay,
      })
      .eq("user_id", userId);

    if (error) {
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
    return NextResponse.json(
      {
        error:
          "Une erreur inattendue est survenue lors de la mise à jour de votre profil.",
      },
      { status: 500 },
    );
  }
}

