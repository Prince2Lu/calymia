"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import ProfileScoreCard from "@/components/dashboard/ProfileScoreCard";
import {
  computeProfileScore,
  type ProfileScoreItem,
  type SophrologueRow,
} from "@/lib/profile-score";

type Props = {
  sophrologue: SophrologueRow;
  supabase: SupabaseClient;
};

export default function ProfileScoreCardWrapper({
  sophrologue,
  supabase,
}: Props) {
  const [data, setData] = useState<{
    score: number;
    items: ProfileScoreItem[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    computeProfileScore(sophrologue, supabase).then((result) => {
      if (!cancelled) setData(result);
    });

    return () => {
      cancelled = true;
    };
  }, [sophrologue, supabase]);

  if (!data) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 h-24 animate-pulse" />
    );
  }

  return <ProfileScoreCard score={data.score} items={data.items} />;
}
