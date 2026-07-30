import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { getSiteUrl } from "@/lib/config/site-url";

type Payload = {
  priceId?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Payload;
  const priceId = body.priceId?.trim();

  if (!priceId) {
    return NextResponse.json({ error: "priceId est requis." }, { status: 400 });
  }

  const allowedPriceIds = [
    process.env.STRIPE_PRICE_ESSENTIEL,
    process.env.STRIPE_PRICE_PROFESSIONNEL,
  ].filter((v): v is string => Boolean(v));

  if (!allowedPriceIds.includes(priceId)) {
    return NextResponse.json(
      { error: "Plan Stripe non autorisé." },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
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
            // no-op in route handler context
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: sophrologue, error: sophrologueError } = await supabaseAdmin
    .from("sophrologues")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  if (sophrologueError) {
    return NextResponse.json(
      { error: "Impossible de récupérer votre profil d'abonnement." },
      { status: 500 },
    );
  }

  if (!sophrologue?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Aucun customer Stripe associé à ce compte." },
      { status: 400 },
    );
  }

  const appUrl = getSiteUrl();

  // Mode "setup" : collecte un moyen de paiement par défaut sans créer
  // de nouvel abonnement. L'upgrade de l'abonnement trial existant se
  // fait dans le webhook checkout.session.completed.
  const session = await stripe.checkout.sessions.create({
    customer: sophrologue.stripe_customer_id,
    mode: "setup",
    payment_method_types: ["card"],
    success_url: `${appUrl}/dashboard/abonnement?success=true`,
    cancel_url: `${appUrl}/dashboard/abonnement`,
    locale: "fr",
    metadata: {
      priceId,
    },
  });

  return NextResponse.json({ url: session.url });
}
