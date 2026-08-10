export type Seance = {
  id: string;
  patient_id: string | null;
  debut_at: string;
  fin_at: string;
  statut: string;
  lien_teleconsultation: string | null;
  patient: {
    prenom: string | null;
    nom: string | null;
    email: string | null;
    telephone: string | null;
  } | null;
  type_seance: { nom: string | null; mode: string | null } | null;
  paiement:
    | { montant_total: number | null; facture_url: string | null }
    | { montant_total: number | null; facture_url: string | null }[]
    | null;
};

export const SEANCES_SELECT =
  "id, patient_id, debut_at, fin_at, statut, lien_teleconsultation, patient:patients(prenom, nom, email, telephone), type_seance:types_seances(nom, mode), paiement:paiements(montant_total, facture_url)";
