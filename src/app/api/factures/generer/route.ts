import { NextRequest, NextResponse } from "next/server";
import { generateAndStoreFacture } from "@/lib/factures/generate";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { seance_id?: string };
    const { seance_id } = body;

    if (!seance_id) {
      return NextResponse.json(
        { error: "seance_id est requis." },
        { status: 400 },
      );
    }

    const result = await generateAndStoreFacture(seance_id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      facture_url: result.facture_url,
    });
  } catch (error) {
    console.error("Facture route - unexpected error:", error);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue." },
      { status: 500 },
    );
  }
}
