import { getServiceRoleClient } from "@/lib/supabase/service-role";

const ALLOWED_CATEGORIES = [
  "pratique-quotidien",
  "publics-specifiques",
  "sante-mentale",
  "sommeil",
  "stress-anxiete",
  "therapies-bien-etre",
] as const;

type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

const ALLOWED_SET = new Set<string>(ALLOWED_CATEGORIES);

const SYSTEM_PROMPT = `Tu classes les spécialités d'un·e sophrologue dans 1 à 3 catégories maximum parmi les 6 catégories suivantes (pas plus, même si plusieurs semblent pertinentes — choisis les plus représentatives) :

- pratique-quotidien
- publics-specifiques
- sante-mentale
- sommeil
- stress-anxiete
- therapies-bien-etre

Le texte fourni peut être un slug technique isolé (ex: "confiance", "arret_tabac"), une liste de libellés en français séparés par des virgules, ou du texte bruité/mal formaté (mots concaténés sans séparateur, fautes, doublons).

Réponds uniquement avec un objet JSON, sans aucun texte autour, format exact :
{"categories": ["slug1", "slug2"]}

Règles :
- Toujours au moins 1 catégorie, même si le texte est ambigu, vague ou imparfaitement formaté — choisis la ou les plus proches.
- Jamais plus de 3 catégories.
- Si plusieurs spécialités listées touchent des domaines différents, priorise les catégories les plus fréquemment représentées dans le texte.`;

export async function classifySpecialitesCategories(
  sophrologueId: string,
  specialitesText: string,
): Promise<void> {
  try {
    const trimmed = specialitesText.trim();
    if (!trimmed) return;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[classify-specialites] ANTHROPIC_API_KEY manquante");
      return;
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 150,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: trimmed }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        "[classify-specialites] Anthropic HTTP",
        res.status,
        body.slice(0, 300),
      );
      return;
    }

    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const rawText = data.content?.[0]?.text;
    if (!rawText || typeof rawText !== "string") {
      console.error("[classify-specialites] Réponse Anthropic sans content[0].text");
      return;
    }

    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as { categories?: unknown };
    if (!Array.isArray(parsed.categories)) {
      console.error("[classify-specialites] JSON sans tableau categories");
      return;
    }

    const categories = parsed.categories
      .filter((v): v is string => typeof v === "string")
      .filter((v): v is AllowedCategory => ALLOWED_SET.has(v))
      .slice(0, 3);

    if (categories.length === 0) {
      console.error("[classify-specialites] Aucune catégorie autorisée après filtrage");
      return;
    }

    const supabase = getServiceRoleClient();
    const { error } = await supabase
      .from("sophrologues")
      .update({ specialites_categories: categories })
      .eq("id", sophrologueId);

    if (error) {
      console.error("[classify-specialites] Update Supabase échoué:", error.message);
    }
  } catch (err) {
    console.error("[classify-specialites]", err);
  }
}
