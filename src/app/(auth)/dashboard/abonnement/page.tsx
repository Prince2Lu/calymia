import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import BillingPortalButton from "@/components/dashboard/BillingPortalButton";

type Plan = "essentiel" | "professionnel" | "cabinet";

type SophrologueBilling = {
  plan: string | null;
  trial_ends_at: string | null;
};

function normalizePlan(raw: string | null | undefined): Plan {
  const p = (raw ?? "").toLowerCase();
  if (p === "essentiel" || p === "professionnel" || p === "cabinet") return p;
  return "essentiel";
}

function formatPlanLabel(plan: Plan): string {
  if (plan === "professionnel") return "Professionnel";
  if (plan === "cabinet") return "Cabinet";
  return "Essentiel";
}

function computeTrialDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const trialEnd = new Date(trialEndsAt).getTime();
  const remainingMs = trialEnd - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

export default async function AbonnementPage() {
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
            // no-op in server component context
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data } = await supabaseAdmin
    .from("sophrologues")
    .select("plan, trial_ends_at")
    .eq("user_id", user.id)
    .maybeSingle<SophrologueBilling>();

  const plan = normalizePlan(data?.plan);
  const trialDaysRemaining = computeTrialDaysRemaining(data?.trial_ends_at ?? null);

  const plans: Array<{
    id: Plan;
    label: string;
    price: string;
    clients: string;
    notes: string;
    emails: string;
    photos: string;
  }> = [
    {
      id: "essentiel",
      label: "Essentiel",
      price: "29 € / mois",
      clients: "15 max",
      notes: "—",
      emails: "—",
      photos: "3",
    },
    {
      id: "professionnel",
      label: "Professionnel",
      price: "59 € / mois",
      clients: "Illimités",
      notes: "Inclus",
      emails: "Inclus",
      photos: "5",
    },
    {
      id: "cabinet",
      label: "Cabinet",
      price: "139 € / mois",
      clients: "Illimités",
      notes: "Inclus",
      emails: "Inclus",
      photos: "10",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <div>
          <h1 className="text-3xl font-semibold text-[#1E3A5F]">Abonnement</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gérez votre essai et votre facturation Stripe.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1E3A5F]">Mon abonnement</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <p>
              Plan actuel :{" "}
              <span className="font-semibold text-[#426F59]">{formatPlanLabel(plan)}</span>
            </p>
            <p>
              Jours d&apos;essai restants :{" "}
              <span className="font-semibold text-[#426F59]">
                {trialDaysRemaining}
              </span>
            </p>
          </div>
          <div className="mt-5">
            <BillingPortalButton />
          </div>
        </section>

        <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Formule
                </th>
                {plans.map((tier) => (
                  <th
                    key={tier.id}
                    className="px-4 py-3 text-left font-semibold text-[#1E3A5F]"
                  >
                    {tier.label} — {tier.price}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-600">Clients</td>
                {plans.map((tier) => (
                  <td key={`${tier.id}-clients`} className="px-4 py-3 text-slate-700">
                    {tier.clients}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-600">
                  Notes de séance
                </td>
                {plans.map((tier) => (
                  <td key={`${tier.id}-notes`} className="px-4 py-3 text-slate-700">
                    {tier.notes}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-600">
                  Modèles d&apos;emails
                </td>
                {plans.map((tier) => (
                  <td key={`${tier.id}-emails`} className="px-4 py-3 text-slate-700">
                    {tier.emails}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-600">
                  Photos vitrine
                </td>
                {plans.map((tier) => (
                  <td key={`${tier.id}-photos`} className="px-4 py-3 text-slate-700">
                    {tier.photos}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-4 py-4 font-medium text-slate-600">Statut</td>
                {plans.map((tier) => (
                  <td key={`${tier.id}-status`} className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        plan === tier.id
                          ? "bg-[#F0F7F4] text-[#426F59]"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {plan === tier.id ? "Plan actuel" : "Disponible"}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
