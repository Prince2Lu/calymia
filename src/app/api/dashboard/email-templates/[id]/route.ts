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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof b.nom === "string") patch.nom = b.nom;
  if (typeof b.sujet === "string") patch.sujet = b.sujet;
  if (typeof b.corps_html === "string") patch.corps_html = b.corps_html;
  if (typeof b.actif === "boolean") patch.actif = b.actif;

  const keys = Object.keys(patch).filter((k) => k !== "updated_at");
  if (keys.length === 0) {
    return NextResponse.json(
      { error: "Aucun champ valide à mettre à jour (nom, sujet, corps_html, actif)." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("email_templates")
    .update(patch)
    .eq("id", id)
    .eq("sophrologue_id", user.id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Modèle introuvable ou non autorisé." },
      { status: 404 },
    );
  }

  return NextResponse.json({ template: data });
}
