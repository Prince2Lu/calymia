import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await sgMail.send({
      to,
      from: { email: "noreply@calymia.com", name: "Calymia" },
      subject,
      html,
    });
    console.log(`[email] Envoyé à ${to} — ${subject}`);
    return { success: true };
  } catch (err) {
    const msg = (err as Error)?.message ?? "Erreur inconnue";
    console.error(`[email] Échec envoi à ${to} — ${subject}:`, msg);
    return { success: false, error: msg };
  }
}
