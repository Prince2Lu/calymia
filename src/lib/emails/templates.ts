const BRAND = "#426F59";
const FOOTER = "Calymia — plateforme de sophrologie | calymia.com";

function baseLayout(content: string): string {
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
            <td style="background:${BRAND};color:#ffffff;padding:20px 24px;text-align:center;">
              <span style="font-size:22px;font-weight:700;letter-spacing:2px;">CALYMIA</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;color:#374151;font-size:15px;line-height:1.6;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 24px;text-align:center;font-size:12px;color:#6b7280;">
              ${FOOTER}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function welcomeSophrologue({
  prenom,
  publicUrl,
}: {
  prenom: string;
  publicUrl?: string;
}): string {
  const urlBlock = publicUrl
    ? `
    <div style="margin:24px 0;padding:16px;background:#F0F7F4;border-radius:8px;border:1px solid #C8DDD4;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#426F59;">Votre page publique Calymia</p>
      <p style="margin:0 0 12px;font-size:13px;color:#6B7280;">Partagez cette URL à vos clients pour qu'ils puissent vous trouver et réserver en ligne :</p>
      <p style="margin:0 0 12px;font-size:13px;word-break:break-all;"><a href="${publicUrl}" style="color:#426F59;font-weight:600;">${publicUrl}</a></p>
      <p style="margin:0;"><a href="${publicUrl}" style="display:inline-block;background:#426F59;color:#ffffff!important;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Voir ma page publique →</a></p>
    </div>`
    : "";

  const content = `
    <p style="margin:0 0 16px;">Bonjour ${prenom},</p>
    <p style="margin:0 0 16px;">Bienvenue sur Calymia ! Votre espace sophrologue est prêt.</p>
    <p style="margin:0 0 16px;">Vous pouvez dès à présent configurer votre profil, vos disponibilités et vos types de séances pour recevoir vos premiers clients en ligne.</p>
    ${urlBlock}
    <p style="margin:0 0 16px;">Si vous avez des questions, n'hésitez pas à nous contacter.</p>
    <p style="margin:24px 0 0;">À bientôt,<br><strong>L'équipe Calymia</strong></p>
  `;
  return baseLayout(content);
}

export function welcomeClient({ prenom }: { prenom: string }): string {
  const content = `
    <p style="margin:0 0 16px;">Bonjour ${prenom},</p>
    <p style="margin:0 0 16px;">Bienvenue sur Calymia ! Votre espace client est créé.</p>
    <p style="margin:0 0 16px;">Vous pouvez désormais gérer vos rendez-vous, consulter votre historique et télécharger vos factures depuis votre espace personnel.</p>
    <p style="margin:24px 0 0;">À bientôt,<br><strong>L'équipe Calymia</strong></p>
  `;
  return baseLayout(content);
}

export function confirmationReservation({
  prenom_client,
  prenom_sophrologue,
  nom_sophrologue,
  date_seance,
  heure_seance,
  type_seance,
  montant,
  facture_url,
}: {
  prenom_client: string;
  prenom_sophrologue: string;
  nom_sophrologue: string;
  date_seance: string;
  heure_seance: string;
  type_seance: string;
  montant: number;
  facture_url?: string | null;
}): string {
  const factureBlock = facture_url
    ? `<p style="margin:16px 0 0;"><a href="${facture_url}" style="display:inline-block;background:${BRAND};color:#ffffff!important;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">Télécharger ma facture</a></p>`
    : "";
  const content = `
    <p style="margin:0 0 16px;">Bonjour ${prenom_client},</p>
    <p style="margin:0 0 16px;">Votre séance est confirmée 🎉 Nous sommes ravis de vous accompagner dans votre parcours de bien-être.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#EAF3DE;border-radius:8px;padding:20px 24px;margin:20px 0;">
      <tr>
        <td style="font-size:14px;color:#374151;line-height:1.8;">
          <p style="margin:0 0 8px;">📅 <strong>${date_seance} à ${heure_seance}</strong></p>
          <p style="margin:0 0 8px;">🧘 <strong>${type_seance}</strong></p>
          <p style="margin:0 0 8px;">👤 Avec <strong>${prenom_sophrologue} ${nom_sophrologue}</strong></p>
          <p style="margin:0;">💶 <strong>${montant} €</strong></p>
        </td>
      </tr>
    </table>
    ${factureBlock}
    <p style="margin:16px 0;">En cas d'imprévu, vous pouvez annuler votre réservation depuis votre espace client jusqu'à 24h avant la séance.</p>
    <p style="margin:24px 0 0;">À très bientôt,<br><strong>${prenom_sophrologue} ${nom_sophrologue}</strong><br><span style="color:#6b7280;font-size:13px;">via Calymia</span></p>
  `;
  return baseLayout(content);
}

export function confirmationReservationSophrologue({
  prenom_sophrologue,
  prenom_client,
  nom_client,
  date_seance,
  heure_seance,
  type_seance,
  montant,
}: {
  prenom_sophrologue: string;
  prenom_client: string;
  nom_client: string;
  date_seance: string;
  heure_seance: string;
  type_seance: string;
  montant: number;
}): string {
  const content = `
    <p style="margin:0 0 16px;">Bonjour ${prenom_sophrologue},</p>
    <p style="margin:0 0 16px;">Une nouvelle réservation a été confirmée.</p>
    <p style="margin:0 0 16px;"><strong>Client :</strong> ${prenom_client} ${nom_client}</p>
    <p style="margin:0 0 16px;"><strong>Date :</strong> ${date_seance} à ${heure_seance}</p>
    <p style="margin:0 0 16px;"><strong>Type :</strong> ${type_seance}</p>
    <p style="margin:0 0 16px;"><strong>Montant :</strong> ${montant.toFixed(2)} €</p>
    <p style="margin:24px 0 0;">À bientôt,<br><strong>L'équipe Calymia</strong></p>
  `;
  return baseLayout(content);
}

export function annulationClient({
  prenom_client,
  prenom_sophrologue,
  date_seance,
  montant_rembourse,
}: {
  prenom_client: string;
  prenom_sophrologue: string;
  date_seance: string;
  montant_rembourse: number;
}): string {
  const remboursementBlock =
    montant_rembourse > 0
      ? `<p style="margin:0 0 16px;">Un remboursement de <strong>${montant_rembourse.toFixed(2)} €</strong> sera effectué sous quelques jours sur votre moyen de paiement.</p>`
      : "";
  const content = `
    <p style="margin:0 0 16px;">Bonjour ${prenom_client},</p>
    <p style="margin:0 0 16px;">Votre séance prévue le <strong>${date_seance}</strong> avec ${prenom_sophrologue} a été annulée.</p>
    ${remboursementBlock}
    <p style="margin:0 0 16px;">Vous pouvez réserver un nouveau créneau à tout moment depuis votre espace Calymia.</p>
    <p style="margin:24px 0 0;">À bientôt,<br><strong>L'équipe Calymia</strong></p>
  `;
  return baseLayout(content);
}

export function annulationSophrologue({
  prenom_sophrologue,
  prenom_client,
  nom_client,
  date_seance,
}: {
  prenom_sophrologue: string;
  prenom_client: string;
  nom_client: string;
  date_seance: string;
}): string {
  const content = `
    <p style="margin:0 0 16px;">Bonjour ${prenom_sophrologue},</p>
    <p style="margin:0 0 16px;">La séance prévue le <strong>${date_seance}</strong> avec ${prenom_client} ${nom_client} a été annulée.</p>
    <p style="margin:0 0 16px;">Cette annulation a bien été enregistrée dans votre agenda.</p>
    <p style="margin:24px 0 0;">À bientôt,<br><strong>L'équipe Calymia</strong></p>
  `;
  return baseLayout(content);
}

export function rappelJ1({
  prenom_client,
  prenom_sophrologue,
  nom_sophrologue,
  date_seance,
  heure_seance,
  type_seance,
}: {
  prenom_client: string;
  prenom_sophrologue: string;
  nom_sophrologue: string;
  date_seance: string;
  heure_seance: string;
  type_seance: string;
}): string {
  const content = `
    <p style="margin:0 0 16px;">Bonjour ${prenom_client},</p>
    <p style="margin:0 0 16px;">Votre séance de sophrologie est <strong>demain</strong>. Voici un petit rappel pour que vous soyez prêt(e) ✨</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#EAF3DE;border-radius:8px;padding:20px 24px;margin:20px 0;">
      <tr>
        <td style="font-size:14px;color:#374151;line-height:1.8;">
          <p style="margin:0 0 8px;">📅 <strong>${date_seance} à ${heure_seance}</strong></p>
          <p style="margin:0 0 8px;">🧘 <strong>${type_seance}</strong></p>
          <p style="margin:0;">👤 Avec <strong>${prenom_sophrologue} ${nom_sophrologue}</strong></p>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0;">Conseil : prenez quelques minutes ce soir pour vous détendre et préparer votre esprit à la séance de demain. Une bonne nuit de sommeil fait toute la différence 🌙</p>
    <p style="margin:24px 0 0;">À demain,<br><strong>${prenom_sophrologue} ${nom_sophrologue}</strong><br><span style="color:#6b7280;font-size:13px;">via Calymia</span></p>
  `;
  return baseLayout(content);
}

export function postSeance({
  prenom_client,
  prenom_sophrologue,
  nom_sophrologue,
  type_seance,
  date_seance,
  heure_seance,
}: {
  prenom_client: string;
  prenom_sophrologue: string;
  nom_sophrologue: string;
  type_seance: string;
  date_seance: string;
  heure_seance: string;
}): string {
  const content = `
    <p style="margin:0 0 16px;">Bonjour ${prenom_client},</p>
    <p style="margin:0 0 16px;">Merci d'avoir pris soin de vous aujourd'hui 🌿 Nous espérons que cette séance vous a apporté détente et sérénité.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#EAF3DE;border-radius:8px;padding:20px 24px;margin:20px 0;">
      <tr>
        <td style="font-size:14px;color:#374151;line-height:1.8;">
          <p style="margin:0 0 8px;">📅 <strong>${date_seance} à ${heure_seance}</strong></p>
          <p style="margin:0 0 8px;">🧘 <strong>${type_seance}</strong></p>
          <p style="margin:0;">👤 Avec <strong>${prenom_sophrologue} ${nom_sophrologue}</strong></p>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0;">Pour prolonger les bienfaits de la séance, prenez le temps de vous hydrater, de vous reposer et d'observer ce que vous ressentez dans les prochaines heures.</p>
    <p style="margin:16px 0;">Votre prochain rendez-vous se réserve directement en ligne, à tout moment 🗓️</p>
    <p style="margin:24px 0 0;">Prenez soin de vous,<br><strong>${prenom_sophrologue} ${nom_sophrologue}</strong><br><span style="color:#6b7280;font-size:13px;">via Calymia</span></p>
  `;
  return baseLayout(content);
}

/** Fragment HTML sophrologue → email complet (en-tête / pied Calymia). */
export function wrapSophrologueEmailHtml(fragment: string): string {
  return baseLayout(fragment);
}
