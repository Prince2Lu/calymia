export type EmailPlaceholderValues = {
  clientPrenom: string;
  clientNom: string;
  seanceDate: string;
  seanceHeure: string;
};

/**
 * Remplace les placeholders {{client.prenom}}, {{client.nom}}, {{seance.date}}, {{seance.heure}}.
 */
export function applyEmailTemplatePlaceholders(
  text: string,
  v: EmailPlaceholderValues,
): string {
  return text
    .replace(/{{client\.prenom}}/g, v.clientPrenom)
    .replace(/{{client\.nom}}/g, v.clientNom)
    .replace(/{{seance\.date}}/g, v.seanceDate)
    .replace(/{{seance\.heure}}/g, v.seanceHeure);
}

export function planAllowsCustomEmailTemplates(
  plan: string | null | undefined,
): boolean {
  const p = (plan ?? "").toLowerCase();
  return p === "professionnel" || p === "cabinet";
}
