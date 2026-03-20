import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { planAllowsCustomEmailTemplates } from "@/lib/email-templates/placeholders";

async function getSessionUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* ignore */
          }
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { data: profil, error: profilErr } = await supabase
    .from("sophrologues")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profilErr || !profil) {
    return NextResponse.json(
      { error: "Profil sophrologue introuvable." },
      { status: 403 },
    );
  }

  if (!planAllowsCustomEmailTemplates(profil.plan)) {
    return NextResponse.json(
      { error: "Feature non disponible sur ce plan" },
      { status: 403 },
    );
  }

  const { data: templates, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("sophrologue_id", user.id)
    .order("type");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: templates ?? [] });
}
