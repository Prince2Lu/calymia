import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ensureAvatarsBucket } from "@/lib/supabase/ensure-avatars-bucket";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * POST — creates the `avatars` storage bucket if it does not exist.
 * Intended for ops / health checks. Client uploads use the browser session + Storage RLS (see supabase/migrations).
 */
export async function POST() {
  try {
    const result = await ensureAvatarsBucket(supabaseAdmin);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, bucket: "avatars" });
  } catch (e) {
    console.error("[ensure-avatars]", e);
    return NextResponse.json(
      { error: "Impossible de vérifier le bucket avatars." },
      { status: 500 },
    );
  }
}
