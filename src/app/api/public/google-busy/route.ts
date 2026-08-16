import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBusyIntervals } from "@/lib/google/freebusy";

export const dynamic = "force-dynamic";

const MAX_RANGE_MS = 40 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sophrologueId = url.searchParams.get("sophrologue_id");
    const timeMinRaw = url.searchParams.get("timeMin");
    const timeMaxRaw = url.searchParams.get("timeMax");

    if (!sophrologueId || !timeMinRaw || !timeMaxRaw) {
      return NextResponse.json({ intervals: [] });
    }

    const rangeStart = new Date(timeMinRaw);
    const rangeEnd = new Date(timeMaxRaw);
    if (
      Number.isNaN(rangeStart.getTime()) ||
      Number.isNaN(rangeEnd.getTime()) ||
      rangeStart >= rangeEnd ||
      rangeEnd.getTime() - rangeStart.getTime() > MAX_RANGE_MS
    ) {
      return NextResponse.json({ intervals: [] });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: sophro } = await supabase
      .from("sophrologues")
      .select("id")
      .eq("id", sophrologueId)
      .eq("actif", true)
      .maybeSingle<{ id: string }>();

    if (!sophro) {
      return NextResponse.json({ intervals: [] });
    }

    const intervals = await getBusyIntervals(sophro.id, rangeStart, rangeEnd);
    return NextResponse.json({ intervals });
  } catch (err) {
    console.error("[google-busy]", err);
    return NextResponse.json({ intervals: [] });
  }
}
