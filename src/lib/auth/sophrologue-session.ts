import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SophrologueSessionInfo = {
  id: string;
  prenom: string | null;
  nom: string | null;
  plan: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
};

export type SophrologueSession = {
  userId: string;
  email: string | null;
  sophrologue: SophrologueSessionInfo | null;
};

/**
 * Session sophrologue dédupliquée par requête RSC (layout + pages).
 * Un seul getUser + un seul select sophrologues par navigation.
 */
export const getSophrologueSession = cache(
  async (): Promise<SophrologueSession | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: sophrologue } = await supabase
      .from("sophrologues")
      .select("id, prenom, nom, plan, trial_ends_at, stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle<SophrologueSessionInfo>();

    return {
      userId: user.id,
      email: user.email ?? null,
      sophrologue: sophrologue ?? null,
    };
  },
);
