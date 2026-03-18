import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import Sidebar from "@/components/dashboard/Sidebar";
import PatientNavbar from "@/components/patient/PatientNavbar";

async function getRole(): Promise<"sophrologue" | "patient"> {
  // ── 1) Resolve authenticated user via cookie-backed anon client ──────────
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
            // Server Component — writes are best-effort
          }
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  // ── 2) Call check-role API (uses service role, bypasses RLS) ─────────────
  try {
    const headerStore = await headers();
    const host = headerStore.get("host") ?? "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";

    const res = await fetch(`${protocol}://${host}/api/auth/check-role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, email: user.email ?? "" }),
      // Avoid caching — role can change after first booking
      cache: "no-store",
    });

    if (res.ok) {
      const data = (await res.json()) as { role?: string };
      if (data.role === "sophrologue") return "sophrologue";
    }
  } catch {
    // If the internal fetch fails, fall back to patient layout (safe default)
  }

  // ── 3) Default: patient (new clients, unknown, or fetch failure) ─────────
  return "patient";
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getRole();

  if (role === "sophrologue") {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <div className="ml-60 min-w-0 flex-1">{children}</div>
      </div>
    );
  }

  // patient or unknown → PatientNavbar
  return (
    <div className="min-h-screen bg-slate-50">
      <PatientNavbar />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
