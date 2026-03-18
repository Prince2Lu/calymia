import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PATHS = ["/dashboard", "/patient", "/clients", "/seances", "/parametres"];

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
