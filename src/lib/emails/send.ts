import sgMail from "@sendgrid/mail";
import { createClient } from "@supabase/supabase-js";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

/** Métadonnées optionnelles pour alimenter le journal `communications` */
export type EmailJournalLog = {
  sophrologue_id: string;
  patient_id?: string | null;
  seance_id?: string | null;
  type: string;
  destinataire_nom?: string | null;
};

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Fire-and-forget : n’interrompt jamais le flux d’envoi d’email */
function logCommunicationEntry(params: {
  sophrologue_id: string;
  patient_id: string | null;
  seance_id: string | null;
  type: string;
  destinataire_email: string;
  destinataire_nom: string | null;
  objet: string;
  contenu: string;
}) {
  const supabase = getServiceSupabase();
  if (!supabase) return;

  void supabase
    .from("communications")
    .insert({
      sophrologue_id: params.sophrologue_id,
      patient_id: params.patient_id,
      seance_id: params.seance_id,
      type: params.type,
      destinataire_email: params.destinataire_email,
      destinataire_nom: params.destinataire_nom,
      objet: params.objet,
      contenu: params.contenu,
      sent_at: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) {
        console.error("[email] Journal communications — insert échoué:", error.message);
      }
    });
}

export async function sendEmail({
  to,
  subject,
  html,
  log,
}: {
  to: string;
  subject: string;
  html: string;
  /** Si renseigné avec sophrologue_id, enregistre une ligne dans `communications` */
  log?: EmailJournalLog;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await sgMail.send({
      to,
      from: { email: "noreply@calymia.com", name: "Calymia" },
      subject,
      html,
    });
    console.log(`[email] Envoyé à ${to} — ${subject}`);
    if (log?.sophrologue_id && log.type) {
      logCommunicationEntry({
        sophrologue_id: log.sophrologue_id,
        patient_id: log.patient_id ?? null,
        seance_id: log.seance_id ?? null,
        type: log.type,
        destinataire_email: to,
        destinataire_nom: log.destinataire_nom ?? null,
        objet: subject,
        contenu: html,
      });
    }
    return { success: true };
  } catch (err) {
    const msg = (err as Error)?.message ?? "Erreur inconnue";
    console.error(`[email] Échec envoi à ${to} — ${subject}:`, msg);
    return { success: false, error: msg };
  }
}
