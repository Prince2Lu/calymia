const BRAND = "#2D6A4F";
const BG = "#FAF8F5";

export type SendAvisEmailParams = {
  patientEmail: string;
  patientPrenom: string;
  sophrologuePrenom: string;
  token: string;
};

export type SendAvisEmailResult = { success: boolean; error?: string };

function buildAvisHtml({
  patientPrenom,
  sophrologuePrenom,
  token,
}: Pick<SendAvisEmailParams, "patientPrenom" | "sophrologuePrenom" | "token">): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://calymia.com";
  const avisUrl = `${baseUrl}/avis?token=${encodeURIComponent(token)}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre avis</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:${BG};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding:36px 32px;color:#374151;font-size:15px;line-height:1.6;">
              <p style="margin:0 0 16px;color:#111827;font-size:16px;">Bonjour ${patientPrenom},</p>
              <p style="margin:0 0 24px;">Votre séance avec ${sophrologuePrenom} est terminée. Partagez votre avis en 30 secondes.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="border-radius:8px;background:${BRAND};">
                    <a href="${avisUrl}" style="display:inline-block;padding:14px 28px;color:#ffffff!important;text-decoration:none;font-weight:600;font-size:15px;border-radius:8px;">Donner mon avis</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;text-align:center;font-size:13px;color:#9CA3AF;">Ce lien est valable 7 jours.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendAvisEmail({
  patientEmail,
  patientPrenom,
  sophrologuePrenom,
  token,
}: SendAvisEmailParams): Promise<SendAvisEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY manquant" };
  }

  const subject = `Comment s'est passée votre séance avec ${sophrologuePrenom} ?`;
  const html = buildAvisHtml({ patientPrenom, sophrologuePrenom, token });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Calymia <contact@calymia.com>",
        to: patientEmail,
        subject,
        html,
      }),
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
