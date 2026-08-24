import { getServiceRoleClient } from "@/lib/supabase/service-role";

export type PaiementManuelStatut =
  | "en_attente"
  | "expire"
  | "deja_paye"
  | "introuvable";

export type PaiementManuelPublic = {
  statut: PaiementManuelStatut;
  sophrologue_nom?: string;
  type_seance_nom?: string;
  debut_at?: string;
  montant?: number;
  seance_id?: string;
};

export type PaiementManuelResolved = PaiementManuelPublic & {
  sophrologue_id?: string;
  patient_id?: string | null;
  type_seance_id?: string | null;
  fin_at?: string;
};

type SophrologueEmbed = { prenom: string | null; nom: string | null } | null;
type TypeSeanceEmbed = {
  nom: string | null;
  tarif: number | null;
} | null;

type SeanceTokenRow = {
  id: string;
  statut: string;
  origine: string;
  expire_at: string | null;
  debut_at: string;
  fin_at: string;
  patient_id: string | null;
  type_seance_id: string | null;
  sophrologue_id: string;
  sophrologue: SophrologueEmbed | SophrologueEmbed[];
  type_seance: TypeSeanceEmbed | TypeSeanceEmbed[];
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function publicFields(row: PaiementManuelResolved): PaiementManuelPublic {
  const out: PaiementManuelPublic = { statut: row.statut };
  if (row.sophrologue_nom !== undefined) out.sophrologue_nom = row.sophrologue_nom;
  if (row.type_seance_nom !== undefined) out.type_seance_nom = row.type_seance_nom;
  if (row.debut_at !== undefined) out.debut_at = row.debut_at;
  if (row.montant !== undefined) out.montant = row.montant;
  if (row.seance_id !== undefined) out.seance_id = row.seance_id;
  return out;
}

export async function resolvePaiementManuelByToken(
  token: string,
): Promise<PaiementManuelResolved> {
  const trimmed = token.trim();
  if (!trimmed) return { statut: "introuvable" };

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("seances")
    .select(
      `id, statut, origine, expire_at, debut_at, fin_at, patient_id, type_seance_id, sophrologue_id,
       sophrologue:sophrologues(prenom, nom),
       type_seance:types_seances(nom, tarif)`,
    )
    .eq("token_paiement_manuel", trimmed)
    .maybeSingle<SeanceTokenRow>();

  if (error) {
    console.error("[paiement-manuel] lecture séance:", error.message);
    return { statut: "introuvable" };
  }
  if (!data) return { statut: "introuvable" };

  if (data.statut !== "en_attente" || data.origine !== "manuelle") {
    return { statut: "deja_paye" };
  }

  if (
    data.expire_at &&
    new Date(data.expire_at).getTime() < Date.now()
  ) {
    return { statut: "expire" };
  }

  const sophro = one(data.sophrologue);
  const typeSeance = one(data.type_seance);
  const sophrologueNom =
    `${sophro?.prenom ?? ""} ${sophro?.nom ?? ""}`.trim() || "Votre sophrologue";
  const tarif = Number(typeSeance?.tarif);
  const montant = Number.isFinite(tarif) && tarif >= 0 ? tarif : 0;

  return {
    statut: "en_attente",
    sophrologue_nom: sophrologueNom,
    type_seance_nom: typeSeance?.nom ?? "Séance",
    debut_at: data.debut_at,
    montant,
    seance_id: data.id,
    sophrologue_id: data.sophrologue_id,
    patient_id: data.patient_id,
    type_seance_id: data.type_seance_id,
    fin_at: data.fin_at,
  };
}

export function toPaiementManuelPublic(
  row: PaiementManuelResolved,
): PaiementManuelPublic {
  return publicFields(row);
}
