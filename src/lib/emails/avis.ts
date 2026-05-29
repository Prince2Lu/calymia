const BRAND = "#2D6A4F";
const BG = "#FAF8F5";
const RESEND_FROM = "Calymia <contact@calymia.com>";

export type SendAvisEmailParams = {
  patientEmail: string;
  patientPrenom: string;
  sophrologuePrenom: string;
  token: string;
};

export type SendAvisNotificationSophrologueParams = {
  sophrologueEmail: string;
  sophrologuePrenom: string;
  patientPrenom: string;
};

export type SendAvisEmailResult = { success: boolean; error?: string };

/** Gabarit commun : header vert CALYMIA, card blanche, footer. */
function buildEmailLayout({
  title,
  bodyHtml,
}: {
  title: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:${BG};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:${BRAND};padding:24px;text-align:center;">
              <span style="display:inline-block;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:4px;">CALYMIA</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#374151;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background:#FAF8F5;padding:20px 32px;text-align:center;border-top:1px solid #EFEAE3;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#6B7280;">Calymia — Votre espace bien-être</p>
              <p style="margin:0;font-size:12px;color:#9CA3AF;">Cet email est envoyé suite à votre séance de sophrologie.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 16px;">
                <tr>
                  <td align="center" style="border-radius:8px;background:${BRAND};">
                    <a href="${href}" style="display:inline-block;padding:14px 32px;color:#ffffff!important;text-decoration:none;font-weight:600;font-size:15px;border-radius:8px;">${label}</a>
                  </td>
                </tr>
              </table>`;
}

/** Envoi via Resend (HTTP POST). Centralise la gestion d'erreur. */
async function sendResendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendAvisEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY manquant" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        success: false,
        error: `Resend ${res.status}: ${detail || res.statusText}`,
      };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return { success: false, error: msg };
  }
}

function buildAvisHtml({
  patientPrenom,
  sophrologuePrenom,
  token,
}: Pick<SendAvisEmailParams, "patientPrenom" | "sophrologuePrenom" | "token">): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://calymia.com";
  const avisUrl = `${baseUrl}/avis?token=${encodeURIComponent(token)}`;

  const bodyHtml = `<p style="margin:0 0 16px;color:#111827;font-size:16px;">Bonjour ${patientPrenom},</p>
              <p style="margin:0 0 28px;">Votre séance avec ${sophrologuePrenom} est terminée. Partagez votre expérience en 30 secondes.</p>
              ${ctaButton(avisUrl, "Donner mon avis")}
              <p style="margin:0;text-align:center;font-size:13px;color:#9CA3AF;">Ce lien est valable 7 jours.</p>`;

  return buildEmailLayout({ title: "Votre avis", bodyHtml });
}

function buildAvisNotificationHtml({
  sophrologuePrenom,
  patientPrenom,
}: Pick<SendAvisNotificationSophrologueParams, "sophrologuePrenom" | "patientPrenom">): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://calymia.com";
  const dashboardUrl = `${baseUrl}/dashboard/avis`;

  const bodyHtml = `<p style="margin:0 0 16px;color:#111827;font-size:16px;">Bonjour ${sophrologuePrenom},</p>
              <p style="margin:0 0 28px;">${patientPrenom} a laissé un avis suite à sa séance. Il est en attente de votre validation.</p>
              ${ctaButton(dashboardUrl, "Valider l'avis")}`;

  return buildEmailLayout({ title: "Nouvel avis en attente", bodyHtml });
}

export async function sendAvisEmail({
  patientEmail,
  patientPrenom,
  sophrologuePrenom,
  token,
}: SendAvisEmailParams): Promise<SendAvisEmailResult> {
  const subject = `Comment s'est passée votre séance avec ${sophrologuePrenom} ?`;
  const html = buildAvisHtml({ patientPrenom, sophrologuePrenom, token });
  return sendResendEmail({ to: patientEmail, subject, html });
}

export async function sendAvisNotificationSophrologue({
  sophrologueEmail,
  sophrologuePrenom,
  patientPrenom,
}: SendAvisNotificationSophrologueParams): Promise<SendAvisEmailResult> {
  const subject = "Un nouvel avis est en attente de validation";
  const html = buildAvisNotificationHtml({ sophrologuePrenom, patientPrenom });
  return sendResendEmail({ to: sophrologueEmail, subject, html });
}
