"use client";

import { useState } from "react";

type PlanCheckoutButtonsProps = {
  essentielPriceId: string | null;
  professionnelPriceId: string | null;
  emphasized?: boolean;
};

export default function PlanCheckoutButtons({
  essentielPriceId,
  professionnelPriceId,
  emphasized = false,
}: PlanCheckoutButtonsProps) {
  const [loadingPlan, setLoadingPlan] = useState<"essentiel" | "professionnel" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const openCheckout = async (
    target: "essentiel" | "professionnel",
    priceId: string | null,
  ) => {
    if (!priceId) {
      setError("Configuration Stripe incomplète pour ce plan.");
      return;
    }

    setLoadingPlan(target);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (!res.ok || !data?.url) {
        setError(data?.error ?? "Impossible de démarrer le checkout Stripe.");
        setLoadingPlan(null);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Impossible de démarrer le checkout Stripe.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className={`space-y-2 ${emphasized ? "rounded-xl border border-orange-200 bg-orange-50 p-4" : ""}`}>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => openCheckout("essentiel", essentielPriceId)}
          disabled={loadingPlan !== null}
          className="inline-flex items-center justify-center rounded-md border border-[#426F59] bg-white px-5 py-2.5 text-sm font-medium text-[#426F59] transition-colors hover:bg-[#f7fbf8] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loadingPlan === "essentiel"
            ? "Ouverture..."
            : "Choisir Essentiel — 29€/mois"}
        </button>

        <button
          type="button"
          onClick={() => openCheckout("professionnel", professionnelPriceId)}
          disabled={loadingPlan !== null}
          className="inline-flex items-center justify-center rounded-md bg-[#426F59] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#355748] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loadingPlan === "professionnel"
            ? "Ouverture..."
            : "Choisir Professionnel — 59€/mois"}
        </button>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
