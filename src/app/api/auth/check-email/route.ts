import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email requis." }, { status: 400 });
    }

    const normalised = email.trim().toLowerCase();

    // Query GoTrue admin endpoint directly — the JS admin API has no getUserByEmail
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=20&filter=${encodeURIComponent(normalised)}`;

    const res = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
    });

    if (!res.ok) {
      console.error("[check-email] GoTrue error:", res.status, await res.text());
      return NextResponse.json({ exists: false });
    }

    const data = await res.json() as { users?: Array<{ email?: string }> };
    const exists =
      (data.users ?? []).some(
        (u) => u.email?.toLowerCase() === normalised,
      );

    console.log("[check-email] email:", normalised, "exists:", exists);
    return NextResponse.json({ exists });
  } catch (err) {
    console.error("[check-email] Erreur:", err);
    return NextResponse.json({ exists: false });
  }
}
