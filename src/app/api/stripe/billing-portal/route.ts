import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
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

  const session = await stripe.billingPortal.sessions.create({
    customer: sophrologue.stripe_customer_id,
    return_url: `${request.nextUrl.origin}/dashboard/abonnement`,
    locale: "fr",
  });

  return NextResponse.json({ url: session.url });
}
