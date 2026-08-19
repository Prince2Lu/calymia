import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { seance_id?: string | number };
    const seance_id = body.seance_id;
    if (seance_id == null || seance_id === "") {
      return NextResponse.json({ error: "seance_id requis" }, { status: 400 });
    }

    const { error } = await supabase
      .from("seances")
      .update({ conversion_tracked_client: true })
      .eq("id", seance_id);

    if (error) {
      console.error("[track-conversion] update error:", error);
      return NextResponse.json({ error: "Impossible de marquer la conversion." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[track-conversion] unexpected error:", err);
    return NextResponse.json({ ok: true });
  }
}
