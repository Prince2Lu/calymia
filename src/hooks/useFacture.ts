"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function useFacture(seanceId: string, options?: { skip?: boolean }) {
  const [factureUrl, setFactureUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!options?.skip);

  useEffect(() => {
    if (options?.skip || !seanceId) {
      setFactureUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const fetchFacture = async () => {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) {
          setFactureUrl(null);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("paiements")
        .select("facture_url")
        .eq("seance_id", seanceId)
        .eq("statut", "reussi")
        .not("facture_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (cancelled) return;

      if (error) {
        console.error("useFacture:", error.message);
        setFactureUrl(null);
      } else {
        const url = data?.[0]?.facture_url;
        setFactureUrl(typeof url === "string" && url.length > 0 ? url : null);
      }
      setLoading(false);
    };

    void fetchFacture();

    return () => {
      cancelled = true;
    };
  }, [seanceId, options?.skip]);

  return { factureUrl, loading };
}
