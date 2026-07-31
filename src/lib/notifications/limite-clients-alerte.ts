import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/emails/send";
import { getSiteUrl } from "@/lib/config/site-url";

const LIMITE_ESSENTIEL = 15;
const INTERNAL_ALERT_EMAIL = "eric@calymia.com";
const FROM_EMAIL = "Calymia <bonjour@calymia.com>";

type SophrologueAlerte = {
  id: string;
  plan: string | null;
  email: string | null;
  prenom: string | null;
  nom: string | null;
  limite_clients_alerte_envoyee_at: string | null;
};

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function emailSophrologueDepassement({
  prenom,
  nbClients,
  abonnementUrl,
}: {
  prenom: string;
  nbClients: number;
  abonnementUrl: string;
}): string {
  const brand = "#426F59";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Calymia</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:${brand};color:#ffffff;padding:20px 24px;text-align:center;">
              <span style="font-size:22px;font-weight:700;letter-spacing:2px;">CALYMIA</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;color:#374151;font-size:15px;line-height:1.6;">
              <p style="margin:0 0 16px;">Bonjour ${prenom},</p>
              <p style="margin:0 0 16px;">Bonne nouvelle : votre cabinet attire de plus en plus de clients&nbsp;!</p>
              <div style="margin:24px 0;padding:16px;background:#F0F7F4;border-radius:8px;border-left:4px solid ${brand};">
                <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${brand};">
                  Vous avez dépassé la limite du plan Essentiel
                </p>
                <p style="margin:0;font-size:14px;color:#374151;">
                  Vous comptez actuellement <strong>${nbClients} clients</strong>. Le plan Essentiel
                  est limité à ${LIMITE_ESSENTIEL} clients. Pour continuer à accueillir de nouveaux
                  patients sans contrainte, passez au plan Professionnel.
                </p>
              </div>
              <p style="margin:0 0 24px;text-align:center;">
                <a href="${abonnementUrl}" style="display:inline-block;background:${brand};color:#ffffff!important;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
                  Voir mon abonnement →
                </a>
              </p>
              <p style="margin:0 0 16px;">Nous sommes là si vous avez la moindre question.</p>
              <p style="margin:24px 0 0;">À bientôt,<br><strong>L'équipe Calymia</strong></p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 24px;text-align:center;font-size:12px;color:#6b7280;">
              Calymia — plateforme de sophrologie | calymia.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function emailInterneRelance({
  prenom,
  nom,
  email,
  nbClients,
}: {
  prenom: string;
  nom: string;
  email: string;
  nbClients: number;
}): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#374151;font-size:14px;line-height:1.6;">
  <p><strong>Sophrologue à relancer — dépassement limite clients (Essentiel)</strong></p>
  <ul>
    <li>Nom : ${prenom} ${nom}</li>
    <li>Email : ${email}</li>
    <li>Nombre de clients : ${nbClients}</li>
    <li>Plan actuel : Essentiel (limite ${LIMITE_ESSENTIEL})</li>
  </ul>
  <p>Relance commerciale manuelle recommandée (upgrade Professionnel).</p>
</body>
</html>`;
}

/**
 * Détecte un dépassement de la limite clients (plan Essentiel) et envoie
 * une alerte unique au sophrologue + une notif interne.
 * Ne doit jamais throw vers l'appelant métier — catch interne.
 */
export async function checkEtNotifierDepassementLimite(
  sophrologueId: string,
): Promise<void> {
  try {
    const supabase = getServiceSupabase();

    const { data: sophrologue, error: sophError } = await supabase
      .from("sophrologues")
      .select("id, plan, email, prenom, nom, limite_clients_alerte_envoyee_at")
      .eq("id", sophrologueId)
      .maybeSingle<SophrologueAlerte>();

    if (sophError || !sophrologue) {
      console.error(
        "[limite-clients] sophrologue introuvable:",
        sophrologueId,
        sophError?.message,
      );
      return;
    }

    if ((sophrologue.plan ?? "").toLowerCase() !== "essentiel") {
      return;
    }

    if (sophrologue.limite_clients_alerte_envoyee_at) {
      return;
    }

    const { count, error: countError } = await supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("sophrologue_id", sophrologueId);

    if (countError) {
      console.error("[limite-clients] count patients:", countError.message);
      return;
    }

    const nbClients = count ?? 0;
    if (nbClients < LIMITE_ESSENTIEL + 1) {
      return;
    }

    const prenom = sophrologue.prenom?.trim() || "Bonjour";
    const nom = sophrologue.nom?.trim() || "";
    const emailSophro = sophrologue.email?.trim();
    if (!emailSophro) {
      console.warn(
        "[limite-clients] pas d'email sophrologue, alerte interne seule:",
        sophrologueId,
      );
    }

    let abonnementUrl: string;
    try {
      abonnementUrl = `${getSiteUrl()}/dashboard/abonnement`;
    } catch (err) {
      console.error("[limite-clients] getSiteUrl:", err);
      return;
    }

    const subjectSophro = "Vous avez dépassé votre limite de clients 🎉";
    const htmlSophro = emailSophrologueDepassement({
      prenom,
      nbClients,
      abonnementUrl,
    });

    const subjectInterne = "Sophrologue à relancer : dépassement limite clients";
    const htmlInterne = emailInterneRelance({
      prenom,
      nom,
      email: emailSophro ?? "(email manquant)",
      nbClients,
    });

    const results: boolean[] = [];

    if (emailSophro) {
      const r = await sendEmail({
        to: emailSophro,
        subject: subjectSophro,
        html: htmlSophro,
        from: FROM_EMAIL,
        log: {
          sophrologue_id: sophrologueId,
          type: "limite_clients_alerte",
          destinataire_nom: [prenom, nom].filter(Boolean).join(" ") || null,
        },
      });
      results.push(r.success);
      if (!r.success) {
        console.error("[limite-clients] échec email sophrologue:", r.error);
      }
    }

    const rInterne = await sendEmail({
      to: INTERNAL_ALERT_EMAIL,
      subject: subjectInterne,
      html: htmlInterne,
      from: FROM_EMAIL,
    });
    results.push(rInterne.success);
    if (!rInterne.success) {
      console.error("[limite-clients] échec email interne:", rInterne.error);
    }

    // Marquer comme alerté seulement si au moins un email a réussi
    // (évite de perdre l'alerte si Resend est down ; si sophro OK et interne KO,
    // on marque quand même pour ne pas spammer le sophrologue).
    const anySuccess = results.some(Boolean);
    if (!anySuccess) {
      console.error(
        "[limite-clients] aucun email envoyé — timestamp non mis à jour",
      );
      return;
    }

    const { error: updateError } = await supabase
      .from("sophrologues")
      .update({ limite_clients_alerte_envoyee_at: new Date().toISOString() })
      .eq("id", sophrologueId);

    if (updateError) {
      console.error(
        "[limite-clients] échec update limite_clients_alerte_envoyee_at:",
        updateError.message,
      );
    } else {
      console.log(
        "[limite-clients] alerte envoyée et timestamp mis à jour:",
        sophrologueId,
        { nbClients },
      );
    }
  } catch (err) {
    // Isolation totale : jamais de throw vers l'appelant (réservation / patients/create)
    console.error("[limite-clients] erreur inattendue (avalée):", err);
    return;
  }
}
