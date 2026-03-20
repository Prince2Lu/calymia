/** True si le HTML de note contient du texte visible (hors balises vides). */
export function seanceNoteHtmlIsNonEmpty(html: string | null | undefined): boolean {
  if (html == null || !String(html).trim()) return false;
  const text = String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0;
}
