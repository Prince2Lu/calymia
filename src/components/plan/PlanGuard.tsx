"use client";

import type { Plan } from "@/hooks/usePlan";

interface PlanGuardProps {
  children: React.ReactNode;
  requiredPlan: "professionnel" | "cabinet";
  currentPlan: Plan;
  featureName: string;
}

export function PlanGuard({
  children,
  requiredPlan,
  currentPlan,
  featureName,
}: PlanGuardProps) {
  const hasAccess =
    requiredPlan === "professionnel"
      ? currentPlan === "professionnel" || currentPlan === "cabinet"
      : currentPlan === "cabinet";

  if (hasAccess) return <>{children}</>;

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#EAF3DE]">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#426F59"
          strokeWidth="2"
          aria-hidden
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <p className="mb-1 text-sm font-medium text-gray-800">{featureName}</p>
      <p className="mb-4 text-xs text-gray-500">
        Disponible à partir du plan{" "}
        <span className="font-medium capitalize">{requiredPlan}</span>
      </p>

      <a
        href="/dashboard/abonnement"
        className="inline-flex items-center gap-2 rounded-full bg-[#426F59] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#355748]"
      >
        Passer au plan{" "}
        {requiredPlan === "professionnel" ? "Professionnel" : "Cabinet"}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}
