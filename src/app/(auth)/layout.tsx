import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import Sidebar from "@/components/dashboard/Sidebar";
import PatientNavbar from "@/components/patient/PatientNavbar";

async function getUserRole(): Promise<"sophrologue" | "patient" | "unknown"> {
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
            // Called from a Server Component — safe to ignore
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "unknown";

  const { data: sophrologue } = await supabase
    .from("sophrologues")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (sophrologue) return "sophrologue";

  const { data: patient } = await supabase
    .from("patients")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (patient) return "patient";

  return "unknown";
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getUserRole();

  if (role === "patient") {
    return (
      <div className="min-h-screen bg-slate-50">
        <PatientNavbar />
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </div>
    );
  }

  // sophrologue or unknown → show sidebar
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="ml-60 min-w-0 flex-1">{children}</div>
    </div>
  );
}
