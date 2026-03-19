import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PATHS = ["/dashboard", "/onboarding", "/patient", "/clients", "/seances", "/parametres"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  if (!isProtected) return NextResponse.next({ request });

  // Initialise la réponse en y propageant les cookies de la requête
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 1) Applique les cookies sur la requête (pour les Server Components en aval)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // 2) Recrée la réponse avec la requête mise à jour
          supabaseResponse = NextResponse.next({ request });
          // 3) Applique les cookies sur la réponse (pour le navigateur)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT : ne jamais appeler supabase.auth.getSession() ici — toujours getUser()
  // getUser() valide le JWT côté serveur Supabase ; getSession() lit seulement le cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/connexion";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ── Onboarding guard ────────────────────────────────────────────────────────
  // If a sophrologue hasn't completed onboarding, redirect them to the wizard.
  // We only check on /dashboard* paths (not /dashboard/onboarding itself, not
  // patient-only routes like /patient, /seances, /clients, /parametres).
  const isDashboard = pathname.startsWith("/dashboard");
  const isOnboardingPage = pathname.startsWith("/onboarding");

  if (isDashboard && !isOnboardingPage) {
    const { data: sophrologue } = await supabase
      .from("sophrologues")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle<{ onboarding_completed: boolean | null }>();

    // If the user IS a sophrologue and hasn't finished onboarding → redirect.
    // Treat both false AND null as "not completed" (existing accounts have null).
    if (sophrologue && sophrologue.onboarding_completed !== true) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      onboardingUrl.search = "";
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Exclut les chemins internes Next.js (_next), les assets statiques
     * et les routes API (qui gèrent leur propre auth).
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
