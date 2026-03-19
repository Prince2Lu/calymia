import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

const PROTECTED_PATHS = ["/dashboard", "/onboarding", "/patient", "/clients", "/seances", "/parametres"];

const AUTH_CACHE_TTL_MS = 30_000; // 30 seconds

const authCache = new Map<
  string,
  { user: User | null; cachedAt: number }
>();

function getSessionCacheKey(request: NextRequest): string {
  const authCookie = request.cookies
    .getAll()
    .find((c) => c.name.includes("auth-token") && !c.name.includes("code-verifier"));
  return (authCookie?.value ?? "").slice(0, 20);
}

function pruneExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of authCache.entries()) {
    if (now - entry.cachedAt > AUTH_CACHE_TTL_MS) authCache.delete(key);
  }
}

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

  // ── Auth check (with 30s in-memory cache to avoid Supabase rate limits) ───
  const cacheKey = getSessionCacheKey(request);
  const cached = authCache.get(cacheKey);
  const now = Date.now();

  let user: User | null;

  if (cached && now - cached.cachedAt < AUTH_CACHE_TTL_MS) {
    user = cached.user;
  } else {
    const { data: { user: u } } = await supabase.auth.getUser();
    user = u ?? null;
    authCache.set(cacheKey, { user, cachedAt: now });
    pruneExpiredCache();
  }

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
