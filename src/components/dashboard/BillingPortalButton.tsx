"use client";

import { useState } from "react";

export default function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/billing-portal", {
        method: "POST",
      });

      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (!res.ok || !data?.url) {
        setError(
          data?.error ??
            "Impossible d'ouvrir le portail de facturation pour le moment.",
        );
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Impossible d'ouvrir le portail de facturation.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-full bg-[#426F59] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#355748] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Ouverture..." : "Gérer mon abonnement"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
