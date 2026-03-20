/** Lignes à insérer dans `email_templates` après création du profil (sophrologue_id = auth user id). */

export const DEFAULT_EMAIL_TEMPLATE_ROWS = [
  {
    type: "rappel" as const,
    nom: "Rappel 24h Standard",
    sujet: "Votre moment de détente vous attend demain 🌿",
    corps_html: `<p>Bonjour {{client.prenom}},</p>
<p>Un petit message pour vous rappeler que votre séance de sophrologie aura lieu demain, le {{seance.date}}, à {{seance.heure}}.</p>
<p>Prenez un instant pour vous préparer à ce moment rien qu'à vous : respiration calme, tenue confortable, hydratation légère...<br>
Nous avancerons ensemble selon votre énergie du jour.</p>
<p>En cas d'empêchement, n'hésitez pas à me prévenir.</p>
<p>Belle journée à vous,<br>Votre sophrologue 🌱</p>`,
    actif: true,
  },
  {
    type: "post_seance" as const,
    nom: "Post séance Standard",
    sujet: "Merci pour votre séance 🌿",
    corps_html: `<p>Bonjour {{client.prenom}},</p>
<p>Merci d'avoir pris ce moment pour vous aujourd'hui.<br>
Votre séance de sophrologie du {{seance.date}} à {{seance.heure}} est maintenant derrière vous — prenez encore quelques instants pour laisser votre corps et votre esprit intégrer ce travail.</p>
<p>Pour prolonger les bénéfices de la séance, vous pouvez :<br>
- respirer calmement pendant 2 à 3 minutes,<br>
- boire un verre d'eau,<br>
- éviter de repartir immédiatement dans un rythme intense.</p>
<p>Si vous ressentez des effets particuliers, positifs ou inconfortables, n'hésitez pas à me le partager : cela m'aidera à ajuster les prochaines séances selon vos besoins.</p>
<p>À bientôt,<br>Votre sophrologue 🌱</p>`,
    actif: true,
  },
];
