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
import { formatParisTime } from "@/lib/timezone";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

// Mêmes fichiers .ttf que les factures — pas de duplication, pas de fetch réseau.
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
      src: path.join(process.cwd(), "src/lib/factures/fonts/DMSans-Regular.ttf"),
    },
    {
      src: path.join(process.cwd(), "src/lib/factures/fonts/DMSans-Medium.ttf"),
      fontWeight: 500,
    },
  ],
});

export type RecuData = {
  numero: string;
  dateEmission: string;
  sophrologueNom: string;
  patientPrenom: string;
  patientNom: string;
  patientEmail: string | null;
  typeSeanceNom: string;
  dateSeance: string;
  montantDeclare: number;
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
  colMontant: { flex: 1.4, textAlign: "right" },
  totalBox: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  totalInner: {
    width: 220,
    borderTopWidth: 2,
    borderTopColor: VERT_FONCE,
    paddingTop: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalDeclareLabel: {
    fontSize: 12,
    fontFamily: "Playfair Display",
    fontWeight: 500,
    color: VERT_FONCE,
  },
  totalDeclareValue: {
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

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function fmtEUR(n: number): string {
  return (
    n.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

function RecuDocument({ data }: { data: RecuData }) {
  const avertissement =
    "Ce document est un récapitulatif fourni par le praticien. Il ne s'agit pas d'une facture émise par Calymia — le montant indiqué n'est pas vérifié par la plateforme.";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>Calymia</Text>
            <Text style={styles.brandTagline}>
              Plateforme de sophrologie
            </Text>
          </View>
          <View>
            <Text style={styles.receiptLabel}>Reçu</Text>
            <Text style={styles.receiptNumber}>N° {data.numero}</Text>
            <Text style={styles.receiptDate}>Émis le {data.dateEmission}</Text>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Séance</Text>
            <Text style={styles.sectionLine}>
              Séance avec {data.sophrologueNom}
            </Text>
          </View>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Client</Text>
            <Text style={styles.sectionLine}>
              {data.patientPrenom} {data.patientNom}
            </Text>
            {data.patientEmail ? (
              <Text style={styles.sectionLineMuted}>{data.patientEmail}</Text>
            ) : null}
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
              styles.colMontant,
              { textAlign: "right" },
            ]}
          >
            Montant déclaré
          </Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={[{ fontSize: 10, color: NOIR }, styles.colDescription]}>
            {data.typeSeanceNom}
          </Text>
          <Text style={[{ fontSize: 10, color: NOIR }, styles.colDate]}>
            {data.dateSeance}
          </Text>
          <Text
            style={[
              { fontSize: 10, color: NOIR, textAlign: "right" },
              styles.colMontant,
            ]}
          >
            {fmtEUR(data.montantDeclare)}
          </Text>
        </View>

        <View style={styles.totalBox}>
          <View style={styles.totalInner}>
            <View style={styles.totalRow}>
              <Text style={styles.totalDeclareLabel}>Montant déclaré</Text>
              <Text style={styles.totalDeclareValue}>
                {fmtEUR(data.montantDeclare)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.legalBox}>
          <Text style={styles.legalText}>{avertissement}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Calymia — plateforme de sophrologie
          </Text>
          <Text style={styles.footerText}>N° {data.numero}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function buildNumeroRecu(): string {
  const annee = new Date().getFullYear();
  const seq = String(Date.now()).slice(-5);
  return `REC-${annee}-${seq}`;
}

export async function generateRecuPDF(data: RecuData): Promise<Buffer> {
  const buffer = await renderToBuffer(<RecuDocument data={data} />);
  return Buffer.from(buffer);
}

type SeanceJoin = {
  id: string;
  origine: string | null;
  montant_declare: number | string | null;
  debut_at: string;
  sophrologue: {
    prenom: string | null;
    nom: string | null;
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

export type GenerateRecuResult =
  | { success: true; recu_url: string }
  | { success: false; error: string };

export async function generateAndStoreRecu(
  seance_id: string,
): Promise<GenerateRecuResult> {
  const supabase = getServiceRoleClient();

  const { data: seance, error: seanceError } = await supabase
    .from("seances")
    .select(
      `id, origine, montant_declare, debut_at,
       sophrologue:sophrologues(prenom, nom),
       patient:patients(prenom, nom, email),
       type_seance:types_seances(nom)`,
    )
    .eq("id", seance_id)
    .maybeSingle<SeanceJoin>();

  if (seanceError || !seance) {
    return { success: false, error: "Séance introuvable" };
  }

  const montantRaw = seance.montant_declare;
  const montantDeclare =
    montantRaw === null || montantRaw === undefined
      ? null
      : Number(montantRaw);

  if (
    seance.origine !== "manuelle" ||
    montantDeclare === null ||
    Number.isNaN(montantDeclare)
  ) {
    return {
      success: false,
      error: "Cette séance n'est pas éligible à un reçu",
    };
  }

  const sophrologue = asOne(seance.sophrologue);
  const patient = asOne(seance.patient);
  const typeSeance = asOne(seance.type_seance);

  const sophrologueNom =
    `${sophrologue?.prenom ?? ""} ${sophrologue?.nom ?? ""}`.trim() ||
    "Sophrologue";

  const recuData: RecuData = {
    numero: buildNumeroRecu(),
    dateEmission: formatParisTime(new Date().toISOString(), "dateTimeLong"),
    sophrologueNom,
    patientPrenom: patient?.prenom ?? "",
    patientNom: patient?.nom ?? "",
    patientEmail: patient?.email ?? null,
    typeSeanceNom: typeSeance?.nom ?? "Séance de sophrologie",
    dateSeance: formatParisTime(seance.debut_at, "dateTimeLong"),
    montantDeclare,
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateRecuPDF(recuData);
  } catch (err) {
    console.error("[recu] Erreur génération PDF:", err);
    return { success: false, error: "Erreur lors de la génération du PDF" };
  }

  const fileName = `recus/${recuData.numero}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from("factures")
    .upload(fileName, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) {
    console.error("[recu] Erreur upload Storage:", uploadErr);
    return { success: false, error: "Erreur lors de l'enregistrement du reçu" };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("factures").getPublicUrl(fileName);

  const { error: updateErr } = await supabase
    .from("seances")
    .update({ recu_url: publicUrl })
    .eq("id", seance_id);

  if (updateErr) {
    console.error("[recu] Erreur update seances.recu_url:", updateErr);
    return { success: false, error: "Erreur lors de la sauvegarde de l'URL" };
  }

  return { success: true, recu_url: publicUrl };
}
