import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";

const resend = new Resend(process.env.RESEND_API_KEY!);

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
    const { error: resendError } = await resend.emails.send({
      from: "Calymia <noreply@calymia.com>",
      to,
      subject,
      html,
    });
    if (resendError) {
      throw new Error(resendError.message);
    }
    console.log(`[email] Envoyé à ${to} — ${subject}`);
    if (log?.sophrologue_id && log.type) {
      const supabase = getServiceSupabase();
      if (supabase) {
        waitUntil(
          Promise.resolve(
            supabase
            .from("communications")
            .insert({
              sophrologue_id: log.sophrologue_id,
              patient_id: log.patient_id ?? null,
              seance_id: log.seance_id ?? null,
              type: log.type,
              destinataire_email: to,
              destinataire_nom: log.destinataire_nom ?? null,
              objet: subject,
              contenu: html,
              sent_at: new Date().toISOString(),
            })
            .then(({ error }) => {
              if (error) {
                console.error("[email] Journal communications — insert échoué:", error.message);
              }
            }),
          ),
        );
      }
    }
    return { success: true };
  } catch (err) {
    const msg = (err as Error)?.message ?? "Erreur inconnue";
    console.error(`[email] Échec envoi à ${to} — ${subject}:`, msg);
    return { success: false, error: msg };
  }
}
