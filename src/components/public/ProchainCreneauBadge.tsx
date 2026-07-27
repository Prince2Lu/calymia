"use client";

import { useEffect, useState } from "react";

type ProchainCreneauResponse = {
  prochainIso: string | null;
};

type ProchainCreneauBadgeProps = {
  sophrologueId: string;
};

function formatProchain(iso: string): string {
  const d = new Date(iso);
  const aujourdhui = new Date();
  const demain = new Date();
  demain.setDate(aujourdhui.getDate() + 1);
  if (d.toDateString() === aujourdhui.toDateString()) {
    return `Aujourd'hui · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (d.toDateString() === demain.toDateString()) {
    return `Demain · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProchainCreneauBadge({ sophrologueId }: ProchainCreneauBadgeProps) {
  const [prochainIso, setProchainIso] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/public/prochain-creneau?sophrologue_id=${encodeURIComponent(sophrologueId)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as ProchainCreneauResponse;
        if (!cancelled) setProchainIso(data.prochainIso ?? null);
      } catch {
        // Silencieux : pas de badge plutôt qu'une erreur visible
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sophrologueId]);

  if (loading) {
    return (
      <div className="rounded-lg bg-[#EAF3DE] px-3 py-2 text-center">
        <div className="mx-auto h-3 w-24 animate-pulse rounded bg-[#3B6D11]/20" />
        <div className="mx-auto mt-1.5 h-4 w-32 animate-pulse rounded bg-[#426F59]/20" />
      </div>
    );
  }

  if (!prochainIso) return null;

  return (
    <div className="rounded-lg bg-[#EAF3DE] px-3 py-2 text-center">
      <p className="text-[10px] font-semibold text-[#3B6D11]">
        Prochain disponible
      </p>
      <p className="text-xs font-bold text-[#426F59]">
        {formatProchain(prochainIso)}
      </p>
    </div>
  );
}
