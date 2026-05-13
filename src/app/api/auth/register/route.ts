import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_EMAIL_TEMPLATE_ROWS } from "@/lib/email-templates/defaults";
import { createStripeCustomerForSophrologue } from "@/lib/stripe/billing";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Debug: vérifier que la clé service role est bien présente
// (cette valeur apparaîtra uniquement dans vos logs serveur)
console.log("Service key exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: Request) {
  try {
    console.log("Register API - POST start");
    const body = await request.json();

    const {
      userId,
      email,
      prenom,
      nom,
      ville,
      departement,
      plan,
      slug,
    } = body as {
      userId?: string;
      email?: string;
      prenom?: string;
      nom?: string;
      ville?: string;
      departement?: string;
      plan?: string;
      slug?: string;
    };

    if (
      !userId ||
      !email ||
      !prenom ||
      !nom ||
      !ville ||
      !departement ||
      !plan ||
      !slug
    ) {
      console.log("Register API - données manquantes", {
        userId,
        email,
        prenom,
        nom,
        ville,
        departement,
        plan,
        slug,
      });
      return NextResponse.json(
        {
          error:
            "Données d’inscription incomplètes pour la création du profil sophrologue.",
        },
        { status: 400 },
      );
    }

    const payload = {
      user_id: userId,
      email,
      prenom,
      nom,
      ville,
      departement,
      plan: "professionnel",
      slug,
    };

    console.log("Register API - insertion sophrologue", {
      userId,
      email,
      plan: "professionnel",
      slug,
    });

    const { data: sophrologue, error } = await supabase
      .from("sophrologues")
      .insert(payload)
      .select("id")
      .single<{ id: string }>();

    console.log("Register API - résultat insertion sophrologue", {
      sophrologueId: sophrologue?.id ?? null,
      hasError: Boolean(error),
    });

    if (error) {
      console.error("Register API - erreur Supabase lors de l’insertion", error);
      return NextResponse.json(
        {
          error:
            "Erreur lors de l’enregistrement du profil sophrologue. Merci de réessayer.",
        },
        { status: 500 },
      );
    }

    if (!sophrologue?.id) {
      console.error(
        "Register API - insertion réussie mais id sophrologue introuvable",
      );
      return NextResponse.json(
        {
          error:
            "Le profil sophrologue a été créé mais l’identifiant est introuvable pour finaliser la facturation.",
        },
        { status: 500 },
      );
    }

    try {
      console.log(
        "Register API - appel createStripeCustomerForSophrologue (before)",
        {
          sophrologueId: sophrologue.id,
          email,
        },
      );
      await createStripeCustomerForSophrologue({
        supabaseAdmin: supabase,
        sophrologueId: sophrologue.id,
        email,
        prenom,
        nom,
      });
      console.log(
        "Register API - appel createStripeCustomerForSophrologue (after)",
        {
          sophrologueId: sophrologue.id,
        },
      );
    } catch (stripeSetupError) {
      console.error(
        "Register API - erreur création customer Stripe",
        stripeSetupError,
      );
      return NextResponse.json(
        {
          error:
            "Le profil a été créé mais la configuration de l’abonnement Stripe a échoué. Merci de contacter le support.",
        },
        { status: 500 },
      );
    }

    const templateRows = DEFAULT_EMAIL_TEMPLATE_ROWS.map((row) => ({
      sophrologue_id: sophrologue.id,
      type: row.type,
      nom: row.nom,
      sujet: row.sujet,
      corps_html: row.corps_html,
      actif: row.actif,
    }));

    const { error: tplError } = await supabase
      .from("email_templates")
      .upsert(templateRows, { onConflict: "sophrologue_id,type" });

    if (tplError) {
      if (tplError.code === "23505") {
        console.warn(
          "Register API — templates déjà présents pour cet utilisateur, ignoré.",
        );
      } else {
        console.error(
          "Register API — insertion email_templates:",
          tplError.message,
        );
        return NextResponse.json(
          {
            error:
              "Profil créé mais les modèles d’emails par défaut n’ont pas pu être enregistrés. Contactez le support ou réessayez.",
          },
          { status: 500 },
        );
      }
    }

    console.log("Register API - POST success", {
      userId,
      sophrologueId: sophrologue.id,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Register API - exception inattendue", error);
    return NextResponse.json(
      {
        error:
          "Une erreur inattendue est survenue lors de la création du profil sophrologue.",
      },
      { status: 500 },
    );
  }
}

