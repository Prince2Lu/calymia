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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const { data: sophrologue } = await supabase
    .from("sophrologues")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle<SophrologueRow>();

  if (!sophrologue) {
    redirect("/connexion");
  }

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
