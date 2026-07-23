import { redirect } from "next/navigation";
import { getSophrologueSession } from "@/lib/auth/sophrologue-session";
import { createClient } from "@/lib/supabase/server";
import {
  addParisCalendarDays,
  startOfWeekParisMonday,
} from "@/lib/timezone";
import SeancesCalendar from "@/components/seances/SeancesCalendar";
import { SEANCES_SELECT, type Seance } from "@/components/seances/types";

export default async function SeancesPage() {
  const session = await getSophrologueSession();
  if (!session?.sophrologue) {
    redirect("/patient");
  }

  const { id: sophrologueId, plan } = session.sophrologue;
  const weekStart = startOfWeekParisMonday(new Date());
  const weekEnd = addParisCalendarDays(weekStart, 7);

  const supabase = await createClient();
  const { data } = await supabase
    .from("seances")
    .select(SEANCES_SELECT)
    .eq("sophrologue_id", sophrologueId)
    .gte("debut_at", weekStart.toISOString())
    .lt("debut_at", weekEnd.toISOString())
    .order("debut_at")
    .returns<Seance[]>();

  return (
    <SeancesCalendar
      sophrologueId={sophrologueId}
      plan={plan}
      initialWeekStartIso={weekStart.toISOString()}
      initialSeances={data ?? []}
    />
  );
}
