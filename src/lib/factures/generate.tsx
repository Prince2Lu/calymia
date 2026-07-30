import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@supabase/supabase-js";
import { formatParisTime } from "@/lib/timezone";

Font.register({
  family: "Playfair Display",
  fonts: [
    {
      src: path.join(
        process.cwd(),
        "src/lib/factures/fonts/PlayfairDisplay-Regular.ttf",
      ),
    },
    {
      src: path.join(
        process.cwd(),
        "src/lib/factures/fonts/PlayfairDisplay-Medium.ttf",
      ),
      fontWeight: 500,
    },
  ],
});

Font.register({
  family: "DM Sans",
  fonts: [
    {
      src: path.join(
        process.cwd(),
        "src/lib/factures/fonts/DMSans-Regular.ttf",
      ),
    },
    {
      src: path.join(
        process.cwd(),
        "src/lib/factures/fonts/DMSans-Medium.ttf",
      ),
      fontWeight: 500,
    },
  ],
});

const MENTION_TVA = "TVA non applicable, art. 293 B du CGI.";

export type FactureData = {
  numero: string;
  dateEmission: string;
  // Vendeur (sophrologue)
  sophrologueNom: string;
  sophrologueAdresse?: string | null;
  sophrologueVille?: string | null;
  sophrologueSiret?: string | null;
  // Client
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

const CREAM = "#FAF8F5";
const VERT_FONCE = "#1B3A2D";
const VERT_MOYEN = "#426F59";
const BOX_BG = "#F1EEE4";
const LEGAL_BG = "#EFE9D8";
const NOIR = "#1A1A18";
const GRIS = "#6B6860";

const styles = StyleSheet.create({
  page: {
    fontFamily: "DM Sans",
    fontSize: 10,
    color: NOIR,
    padding: 48,
    backgroundColor: CREAM,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
    borderBottomWidth: 2,
    borderBottomColor: VERT_FONCE,
    paddingBottom: 16,
  },
  brandName: {
    fontSize: 28,
    fontFamily: "Playfair Display",
    color: VERT_FONCE,
    letterSpacing: 1,
  },
  brandTagline: {
    fontSize: 9,
    color: GRIS,
    marginTop: 2,
  },
  receiptLabel: {
    fontSize: 13,
    fontFamily: "Playfair Display",
    fontWeight: 500,
    color: VERT_MOYEN,
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
    backgroundColor: BOX_BG,
    borderRadius: 6,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "DM Sans",
    fontWeight: 500,
    color: VERT_FONCE,
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
    backgroundColor: VERT_FONCE,
    borderRadius: 4,
    padding: "8 12",
    marginBottom: 2,
  },
  tableHeaderText: {
    fontSize: 9,
    fontFamily: "DM Sans",
    fontWeight: 500,
    color: CREAM,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E0D6",
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
    borderTopColor: VERT_FONCE,
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
    fontFamily: "Playfair Display",
    fontWeight: 500,
    color: VERT_FONCE,
  },
  totalTTCValue: {
    fontSize: 12,
    fontFamily: "Playfair Display",
    fontWeight: 500,
    color: VERT_FONCE,
  },
  legalBox: {
    marginTop: 24,
    backgroundColor: LEGAL_BG,
    borderLeftWidth: 3,
    borderLeftColor: VERT_MOYEN,
    padding: "8 12",
    borderRadius: 4,
  },
  legalText: {
    fontSize: 9,
    color: NOIR,
    marginBottom: 4,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: "#E5E0D6",
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
  const mandatText = `Facture éditée par KLS3 SARL (SIRET 949 563 340 00015, 14 allée du Fairway, 57200 Sarreguemines), pour le compte et au nom de ${data.sophrologueNom}, dans le cadre du mandat de facturation Calymia.`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>Calymia</Text>
            <Text style={styles.brandTagline}>
              Plateforme de gestion pour sophrologues
            </Text>
          </View>
          <View>
            <Text style={styles.receiptLabel}>Facture</Text>
            <Text style={styles.receiptNumber}>N° {data.numero}</Text>
            <Text style={styles.receiptDate}>
              Émis le {data.dateEmission}
            </Text>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Vendeur</Text>
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
            {data.sophrologueSiret ? (
              <Text style={styles.sectionLineMuted}>
                SIRET : {data.sophrologueSiret}
              </Text>
            ) : null}
          </View>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Client</Text>
            <Text style={styles.sectionLine}>
              {data.patientPrenom} {data.patientNom}
            </Text>
            <Text style={styles.sectionLineMuted}>{data.patientEmail}</Text>
          </View>
        </View>

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

        <View style={styles.legalBox}>
          <Text style={styles.legalText}>{MENTION_TVA}</Text>
          <Text style={styles.legalText}>{mandatText}</Text>
        </View>

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
    siret: string | null;
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
  return formatParisTime(iso, "dateTimeLong");
}

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

  const { data: seance, error: seanceError } = await supabase
    .from("seances")
    .select(
      `id, debut_at, fin_at,
       sophrologue:sophrologues(id, prenom, nom, adresse, ville, siret),
       patient:patients(prenom, nom, email),
       type_seance:types_seances(nom)`,
    )
    .eq("id", seance_id)
    .maybeSingle<SeanceJoin>();

  if (seanceError || !seance) {
    console.error("[Facture] Séance introuvable:", seanceError);
    return { success: false, error: "Séance introuvable." };
  }

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

  const dureeMs =
    new Date(seance.fin_at).getTime() - new Date(seance.debut_at).getTime();
  const dureeMinutes = Math.round(dureeMs / (1000 * 60));

  const sophrologueNom =
    `${seance.sophrologue?.prenom ?? ""} ${seance.sophrologue?.nom ?? ""}`.trim() ||
    "Sophrologue";

  const factureData: FactureData = {
    numero: buildNumeroFacture(),
    dateEmission: formatDateFR(new Date().toISOString()),
    sophrologueNom,
    sophrologueAdresse: seance.sophrologue?.adresse ?? null,
    sophrologueVille: seance.sophrologue?.ville ?? null,
    sophrologueSiret: seance.sophrologue?.siret ?? null,
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

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateFacturePDF(factureData);
    console.log("[Facture] PDF généré, taille:", pdfBuffer.byteLength, "octets");
  } catch (pdfErr) {
    console.error("[Facture] Erreur génération PDF:", pdfErr);
    return { success: false, error: "Échec de la génération du PDF." };
  }

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

  const { data: publicUrlData } = supabase.storage
    .from("factures")
    .getPublicUrl(fileName);

  const factureUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from("paiements")
    .update({ facture_url: factureUrl })
    .eq("id", paiement.id);

  if (updateError) {
    console.error("[Facture] Erreur mise à jour paiement:", updateError);
  } else {
    console.log("[Facture] facture_url enregistrée dans paiements");
  }

  console.log("[Facture] Génération terminée:", factureUrl);
  return { success: true, facture_url: factureUrl };
}
