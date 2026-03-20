import { NextResponse } from "next/server";
import { fetchAuthUserIdByEmail } from "@/lib/supabase/fetch-auth-user-id-by-email";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email requis." }, { status: 400 });
    }

    const normalised = email.trim().toLowerCase();

    const userId = await fetchAuthUserIdByEmail(normalised);
    const exists = userId != null;

    console.log("[check-email] email:", normalised, "exists:", exists);
    return NextResponse.json({ exists });
  } catch (err) {
    console.error("[check-email] Erreur:", err);
    return NextResponse.json({ exists: false });
  }
}
