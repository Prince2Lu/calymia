import { NextResponse } from "next/server";
import {
  resolvePaiementManuelByToken,
  toPaiementManuelPublic,
} from "@/lib/booking/paiement-manuel";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const resolved = await resolvePaiementManuelByToken(token ?? "");
    return NextResponse.json(toPaiementManuelPublic(resolved));
  } catch (err) {
    console.error("[paiement-manuel GET]", err);
    return NextResponse.json({ statut: "introuvable" });
  }
}
