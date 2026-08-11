import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next");

  if (!code) {
    const errorUrl = new URL("/connexion", request.url);
    errorUrl.searchParams.set("error", "Le fournisseur d'authentification n'a pas renvoyé de code valide.");
    return NextResponse.redirect(errorUrl);
  }

  // `next` (posé par resetPasswordForEmail) prioritaire ; `type=recovery` en fallback
  const redirectTo =
    next === "/reinitialiser-mot-de-passe" || type === "recovery"
      ? new URL("/reinitialiser-mot-de-passe", request.url)
      : new URL("/dashboard", request.url);

  const response = NextResponse.redirect(redirectTo);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { response.cookies.set({ name, value, ...options }); },
        remove(name: string, options: CookieOptions) { response.cookies.set({ name, value: "", ...options }); },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const errorUrl = new URL("/connexion", request.url);
    errorUrl.searchParams.set("error", "La connexion avec le fournisseur d'authentification a échoué.");
    return NextResponse.redirect(errorUrl);
  }

  return response;
}
