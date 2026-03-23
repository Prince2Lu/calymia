"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export type Plan = "essentiel" | "professionnel" | "cabinet";

export interface PlanFeatures {
  plan: Plan;
  /** null = illimité */
  maxClients: number | null;
  notesSeance: boolean;
  journalCommunications: boolean;
  emailRappelPersonnalise: boolean;
  emailPostSeance: boolean;
  smsRappel: boolean;
  maxPhotos: number;
}

const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  essentiel: {
    plan: "essentiel",
    maxClients: 15,
    notesSeance: false,
    journalCommunications: false,
    emailRappelPersonnalise: false,
    emailPostSeance: false,
    smsRappel: false,
    maxPhotos: 3,
  },
  professionnel: {
    plan: "professionnel",
    maxClients: null,
    notesSeance: true,
    journalCommunications: true,
    emailRappelPersonnalise: true,
    emailPostSeance: true,
    smsRappel: true,
    maxPhotos: 5,
  },
  cabinet: {
    plan: "cabinet",
    maxClients: null,
    notesSeance: true,
    journalCommunications: true,
    emailRappelPersonnalise: true,
    emailPostSeance: true,
    smsRappel: true,
    maxPhotos: 10,
  },
};

export function normalizePlan(raw: string | null | undefined): Plan {
  const p = (raw ?? "").toLowerCase();
  if (p === "essentiel" || p === "professionnel" || p === "cabinet") {
    return p;
  }
  return "essentiel";
}

export function usePlan() {
  const [features, setFeatures] = useState<PlanFeatures>(
    PLAN_FEATURES.essentiel,
  );
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => {
    let cancelled = false;
    const fetchPlan = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("sophrologues")
        .select("plan")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const row = data as { plan?: string } | null;
      if (row?.plan) {
        const p = normalizePlan(row.plan);
        setFeatures(PLAN_FEATURES[p]);
      }
      setLoading(false);
    };
    void fetchPlan();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return { ...features, loading };
}

export const isProPlus = (plan: Plan) =>
  plan === "professionnel" || plan === "cabinet";
