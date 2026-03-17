import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@supabase/supabase-js";

export type FactureData = {
  // Numéro de reçu
  numero: string;
  dateEmission: string;
  // Sophrologue
  sophrologueNom: string;
  sophrologueAdresse?: string | null;
  sophrologueVille?: string | null;
  // Patient
  patientPrenom: string;
  patientNom: string;
  patientEmail: string;
  // Séance
  typeSeanceNom: string;
  dateSeance: string;
  dureeMinutes: number;
  // Montant
  montantHT: number;
  montantTTC: number;
};

const BLEU = "#1E3A5F";
const BLEU_MOYEN = "#2E75B6";
const GRIS = "#64748b";
const GRIS_CLAIR = "#f1f5f9";
const NOIR = "#1e293b";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: NOIR,
    padding: 48,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
    borderBottomWidth: 2,
    borderBottomColor: BLEU,
    paddingBottom: 16,
  },
  brandName: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: BLEU,
    letterSpacing: 2,
  },
  brandTagline: {
    fontSize: 9,
    color: GRIS,
    marginTop: 2,
  },
  receiptLabel: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: BLEU_MOYEN,
    textAlign: "right",
  },
  receiptNumber: {
    fontSize: 9,
    color: GRIS,
    textAlign: "right",
    marginTop: 4,
  },
  receiptDate: {
    fontSize: 9,
    color: GRIS,
    textAlign: "right",
    marginTop: 2,
  },
  sectionRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 28,
  },
  sectionBox: {
    flex: 1,
    backgroundColor: GRIS_CLAIR,
    borderRadius: 6,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BLEU,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  sectionLine: {
    fontSize: 10,
    color: NOIR,
    marginBottom: 2,
  },
  sectionLineMuted: {
    fontSize: 9,
    color: GRIS,
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BLEU,
    borderRadius: 4,
    padding: "8 12",
    marginBottom: 2,
  },
  tableHeaderText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    padding: "8 12",
  },
  colDescription: { flex: 3 },
  colDate: { flex: 2 },
  colDuree: { flex: 1, textAlign: "center" },
  colMontant: { flex: 1.2, textAlign: "right" },
  totalBox: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  totalInner: {
    width: 200,
    borderTopWidth: 2,
    borderTopColor: BLEU,
    paddingTop: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 10,
    color: GRIS,
  },
  totalValue: {
    fontSize: 10,
    color: NOIR,
  },
  totalTTCLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: BLEU,
  },
  totalTTCValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: BLEU,
  },
  legalBox: {
    marginTop: 24,
    backgroundColor: "#fef9c3",
    borderLeftWidth: 3,
    borderLeftColor: "#eab308",
    padding: "8 12",
    borderRadius: 4,
  },
  legalText: {
    fontSize: 9,
    color: "#713f12",
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: GRIS,
  },
});

function FactureDocument({ data }: { data: FactureData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>CALYMIA</Text>
            <Text style={styles.brandTagline}>
              Plateforme de gestion pour sophrologues
            </Text>
          </View>
          <View>
            <Text style={styles.receiptLabel}>Reçu de paiement</Text>
            <Text style={styles.receiptNumber}>N° {data.numero}</Text>
            <Text style={styles.receiptDate}>
              Émis le {data.dateEmission}
            </Text>
          </View>
        </View>

        {/* Sophrologue + Patient */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Sophrologue</Text>
            <Text style={styles.sectionLine}>{data.sophrologueNom}</Text>
            {data.sophrologueAdresse ? (
              <Text style={styles.sectionLineMuted}>
                {data.sophrologueAdresse}
              </Text>
            ) : null}
            {data.sophrologueVille ? (
              <Text style={styles.sectionLineMuted}>
                {data.sophrologueVille}
              </Text>
            ) : null}
          </View>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Patient</Text>
            <Text style={styles.sectionLine}>
              {data.patientPrenom} {data.patientNom}
            </Text>
            <Text style={styles.sectionLineMuted}>{data.patientEmail}</Text>
          </View>
        </View>

        {/* Tableau séance */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colDescription]}>
            Description
          </Text>
          <Text style={[styles.tableHeaderText, styles.colDate]}>
            Date de séance
          </Text>
          <Text
            style={[
              styles.tableHeaderText,
              styles.colDuree,
              { textAlign: "center" },
            ]}
          >
            Durée
          </Text>
          <Text
            style={[
              styles.tableHeaderText,
              styles.colMontant,
              { textAlign: "right" },
            ]}
          >
            Montant HT
          </Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={[{ fontSize: 10, color: NOIR }, styles.colDescription]}>
            {data.typeSeanceNom}
          </Text>
          <Text style={[{ fontSize: 10, color: GRIS }, styles.colDate]}>
            {data.dateSeance}
          </Text>
          <Text
            style={[
              { fontSize: 10, color: GRIS, textAlign: "center" },
              styles.colDuree,
            ]}
          >
            {data.dureeMinutes} min
          </Text>
          <Text
            style={[
              { fontSize: 10, color: NOIR, textAlign: "right" },
              styles.colMontant,
            ]}
          >
            {data.montantHT.toFixed(2)} €
          </Text>
        </View>

        {/* Total */}
        <View style={styles.totalBox}>
          <View style={styles.totalInner}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Sous-total HT</Text>
              <Text style={styles.totalValue}>
                {data.montantHT.toFixed(2)} €
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVA (0%)</Text>
              <Text style={styles.totalValue}>0,00 €</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalTTCLabel}>Total TTC</Text>
              <Text style={styles.totalTTCValue}>
                {data.montantTTC.toFixed(2)} €
              </Text>
            </View>
          </View>
        </View>

        {/* Mention légale */}
        <View style={styles.legalBox}>
          <Text style={styles.legalText}>
            TVA non applicable — article 293 B du CGI
          </Text>
        </View>

        {/* Pied de page */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Calymia — plateforme de gestion pour sophrologues
          </Text>
          <Text style={styles.footerText}>N° {data.numero}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateFacturePDF(data: FactureData): Promise<Buffer> {
  const buffer = await renderToBuffer(<FactureDocument data={data} />);
  return Buffer.from(buffer);
}

export function buildNumeroFacture(): string {
  const annee = new Date().getFullYear();
  const seq = String(Date.now()).slice(-5);
  return `CAL-${annee}-${seq}`;
}

// ─── Types internes pour la récupération Supabase ───────────────────────────

type SeanceJoin = {
  id: string;
  debut_at: string;
  fin_at: string;
  sophrologue: {
    id: string;
    prenom: string | null;
    nom: string | null;
    adresse: string | null;
    ville: string | null;
  } | null;
  patient: {
    prenom: string | null;
    nom: string | null;
    email: string | null;
  } | null;
  type_seance: {
    nom: string | null;
  } | null;
};

type PaiementRow = {
  id: string;
  montant_total: number;
  stripe_payment_intent_id: string | null;
};

function formatDateFR(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ─── Fonction principale : génère et stocke la facture pour une séance ───────

export type GenerateFactureResult =
  | { success: true; facture_url: string }
  | { success: false; error: string };

export async function generateAndStoreFacture(
  seance_id: string,
): Promise<GenerateFactureResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  console.log("[Facture] Début génération pour séance:", seance_id);

  // 1) Récupérer la séance avec ses relations
  const { data: seance, error: seanceError } = await supabase
    .from("seances")
    .select(
      `id, debut_at, fin_at,
       sophrologue:sophrologues(id, prenom, nom, adresse, ville),
       patient:patients(prenom, nom, email),
       type_seance:types_seances(nom)`,
    )
    .eq("id", seance_id)
    .maybeSingle<SeanceJoin>();

  if (seanceError || !seance) {
    console.error("[Facture] Séance introuvable:", seanceError);
    return { success: false, error: "Séance introuvable." };
  }

  // 2) Récupérer le paiement réussi
  const { data: paiement, error: paiementError } = await supabase
    .from("paiements")
    .select("id, montant_total, stripe_payment_intent_id")
    .eq("seance_id", seance_id)
    .eq("statut", "reussi")
    .maybeSingle<PaiementRow>();

  if (paiementError || !paiement) {
    console.error("[Facture] Paiement introuvable:", paiementError);
    return { success: false, error: "Paiement introuvable pour cette séance." };
  }

  // 3) Calculer la durée en minutes
  const dureeMs =
    new Date(seance.fin_at).getTime() - new Date(seance.debut_at).getTime();
  const dureeMinutes = Math.round(dureeMs / (1000 * 60));

  // 4) Construire les données de la facture
  const sophrologueNom =
    `${seance.sophrologue?.prenom ?? ""} ${seance.sophrologue?.nom ?? ""}`.trim() ||
    "Sophrologue";

  const factureData: FactureData = {
    numero: buildNumeroFacture(),
    dateEmission: formatDateFR(new Date().toISOString()),
    sophrologueNom,
    sophrologueAdresse: seance.sophrologue?.adresse ?? null,
    sophrologueVille: seance.sophrologue?.ville ?? null,
    patientPrenom: seance.patient?.prenom ?? "",
    patientNom: seance.patient?.nom ?? "",
    patientEmail: seance.patient?.email ?? "",
    typeSeanceNom: seance.type_seance?.nom ?? "Séance de sophrologie",
    dateSeance: formatDateFR(seance.debut_at),
    dureeMinutes,
    montantHT: paiement.montant_total,
    montantTTC: paiement.montant_total,
  };

  console.log("[Facture] Données construites, numéro:", factureData.numero);

  // 5) Générer le PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateFacturePDF(factureData);
    console.log("[Facture] PDF généré, taille:", pdfBuffer.byteLength, "octets");
  } catch (pdfErr) {
    console.error("[Facture] Erreur génération PDF:", pdfErr);
    return { success: false, error: "Échec de la génération du PDF." };
  }

  // 6) Upload dans Supabase Storage (bucket "factures")
  const fileName = `${factureData.numero}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("factures")
    .upload(fileName, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("[Facture] Erreur upload Storage:", uploadError);
    return { success: false, error: "Impossible d'uploader la facture." };
  }

  console.log("[Facture] Upload Storage OK:", fileName);

  // 7) Récupérer l'URL publique
  const { data: publicUrlData } = supabase.storage
    .from("factures")
    .getPublicUrl(fileName);

  const factureUrl = publicUrlData.publicUrl;

  // 8) Mettre à jour le paiement avec l'URL
  const { error: updateError } = await supabase
    .from("paiements")
    .update({ facture_url: factureUrl })
    .eq("id", paiement.id);

  if (updateError) {
    console.error("[Facture] Erreur mise à jour paiement:", updateError);
    // Non-bloquant : la facture est générée même si la mise à jour échoue
  } else {
    console.log("[Facture] facture_url enregistrée dans paiements");
  }

  console.log("[Facture] Génération terminée:", factureUrl);
  return { success: true, facture_url: factureUrl };
}
