import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AvisDashboard, type AvisAvecPatient } from "@/components/avis/AvisDashboard";

type SophrologueRow = { id: string };

type PatientEmbed = {
  prenom: string | null;
  nom: string | null;
} | null;

type AvisJoinRow = Omit<AvisAvecPatient, "patient_prenom" | "patient_nom"> & {
  patient: PatientEmbed | PatientEmbed[];
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function DashboardAvisPage() {
  const supabase = await createClient();

  console.time("avis-page:TOTAL");

  console.time("avis-page:getUser");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.timeEnd("avis-page:getUser");

  if (!user) {
    console.timeEnd("avis-page:TOTAL");
    redirect("/connexion");
  }

  console.time("avis-page:sophrologues");
  const { data: sophrologue } = await supabase
    .from("sophrologues")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle<SophrologueRow>();
  console.timeEnd("avis-page:sophrologues");

  if (!sophrologue) {
    console.timeEnd("avis-page:TOTAL");
    redirect("/connexion");
  }

  console.time("avis-page:avis-query");
  const { data: rows } = await supabase
    .from("avis")
    .select(
      `id, sophrologue_id, patient_id, seance_id, note, commentaire, statut,
       token_utilise, token_expire_at, email_envoye, created_at, updated_at,
       patient:patients(prenom, nom)`,
    )
    .eq("sophrologue_id", sophrologue.id)
    .order("created_at", { ascending: false })
    .returns<AvisJoinRow[]>();
  console.timeEnd("avis-page:avis-query");

  console.timeEnd("avis-page:TOTAL");

  const avis: AvisAvecPatient[] = (rows ?? []).map((row) => {
    const patient = one(row.patient);
    const { patient: _patient, ...rest } = row;
    return {
      ...rest,
      patient_prenom: patient?.prenom ?? null,
      patient_nom: patient?.nom ?? null,
    };
  });

  return <AvisDashboard avis={avis} />;
}
