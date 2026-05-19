import { normalizePlan, type Plan } from "@/hooks/usePlan";

export function computeTrialDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const trialEnd = new Date(trialEndsAt).getTime();
  const remainingMs = trialEnd - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

export function isTrialActive(trialEndsAt: string | null | undefined): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() > Date.now();
}

export function isTrialExpiredWithoutPaidPlan(
  trialEndsAt: string | null | undefined,
  plan: string | null | undefined,
): boolean {
  if (!trialEndsAt) return false;
  if (new Date(trialEndsAt).getTime() > Date.now()) return false;
  return normalizePlan(plan) === "essentiel";
}

export type SidebarPlanBadge = {
  label: string;
  className: string;
};

function formatPlanLabel(plan: Plan): string {
  if (plan === "professionnel") return "Professionnel";
  if (plan === "cabinet") return "Cabinet";
  return "Essentiel";
}

function planBadgeClassName(plan: Plan): string {
  switch (plan) {
    case "essentiel":
      return "bg-gray-100 text-gray-600";
    case "professionnel":
      return "bg-[#EAF3DE] text-[#3B6D11]";
    case "cabinet":
      return "bg-[#EEF2FF] text-[#4338CA]";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

/** Libellé + classes du badge « Plan actuel » (sidebar). */
export function getSidebarPlanBadge(
  plan: string | null | undefined,
  trialEndsAt: string | null | undefined,
): SidebarPlanBadge {
  if (isTrialActive(trialEndsAt)) {
    const days = computeTrialDaysRemaining(trialEndsAt ?? null);
    const label =
      days > 0 ? `Essai gratuit — ${days}j` : "Essai gratuit";
    return {
      label,
      className:
        "bg-[#F0F7F4] text-[#426F59] text-sm font-semibold normal-case",
    };
  }

  if (isTrialExpiredWithoutPaidPlan(trialEndsAt, plan)) {
    return {
      label: "Essai expiré",
      className:
        "bg-red-50 text-red-600 text-xs font-semibold normal-case ring-1 ring-red-200",
    };
  }

  const normalized = normalizePlan(plan);
  return {
    label: formatPlanLabel(normalized),
    className: `${planBadgeClassName(normalized)} text-xs font-medium capitalize`,
  };
}
