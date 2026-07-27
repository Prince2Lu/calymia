import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeNextAvailableSlotIso } from "@/lib/booking/compute-next-slot";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sophrologueId = new URL(req.url).searchParams.get("sophrologue_id");

  if (!sophrologueId) {
    return NextResponse.json(
      { error: "sophrologue_id requis" },
      { status: 400 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const prochainIso = await computeNextAvailableSlotIso(supabase, sophrologueId);

  return NextResponse.json({ prochainIso });
}
