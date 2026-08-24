export type ExtractionPatient = {
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
};

export type ExtractionSeance = {
  date: string | null;
  heure: string | null;
  type_seance_id: string | null;
};

export type ExtractionConfiance = {
  prenom: boolean;
  nom: boolean;
  email: boolean;
  telephone: boolean;
  date: boolean;
  heure: boolean;
  type_seance_id: boolean;
};

export type ExtractionResult =
  | {
      ok: true;
      patient: ExtractionPatient;
      seance: ExtractionSeance;
      confiance: ExtractionConfiance;
    }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeTime(value: string | null): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function textFromAnthropicContent(
  content: Array<{ type?: string; text?: string }> | undefined,
): string | null {
  if (!Array.isArray(content)) return null;
  for (let i = content.length - 1; i >= 0; i--) {
    const block = content[i];
    if (block?.type === "text" && typeof block.text === "string" && block.text.trim()) {
      return block.text;
    }
  }
  for (const block of content) {
    if (typeof block.text === "string" && block.text.trim()) return block.text;
  }
  return null;
}

function validIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function buildSystemPrompt(
  nowIso: string,
  typesSeances: { id: string; nom: string }[],
): string {
  const now = new Date(nowIso);
  const nowOk = !Number.isNaN(now.getTime());
  const ref = nowOk ? now : new Date();
  const parisLong = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(ref);
  const typesJson = JSON.stringify(
    typesSeances.map((t) => ({ id: t.id, nom: t.nom })),
  );

  return `Tu extraies les informations d'un rendez-vous de sophrologie depuis un message client (email, SMS ou WhatsApp), souvent informel, en français.

Référence temporelle (Europe/Paris) : ${parisLong}
Instant ISO fourni : ${nowOk ? nowIso : ref.toISOString()}
Utilise cette référence pour résoudre les dates relatives (« demain », « jeudi prochain », « dans 15 jours », « mardi matin »). Si aucune heure n'est indiquée, heure = null. Si aucune date n'est indiquée, date = null.

Types de séances du sophrologue (id + nom). Si le message mentionne un type qui correspond clairement à l'un d'eux, renseigne type_seance_id avec cet id. Sinon type_seance_id = null. N'invente jamais un id absent de cette liste :
${typesJson}

Réponds uniquement avec un objet JSON, sans aucun texte autour, format exact :
{"patient":{"prenom":null,"nom":null,"email":null,"telephone":null},"seance":{"date":null,"heure":null,"type_seance_id":null},"confiance":{"prenom":false,"nom":false,"email":false,"telephone":false,"date":false,"heure":false,"type_seance_id":false}}

Règles :
- date au format YYYY-MM-DD ou null
- heure au format HH:mm (24h) ou null
- confiance.<champ> = true seulement si la valeur est clairement présente dans le message
- Si une info est absente ou ambiguë : valeur null et confiance false
- Ne pas inventer d'email ou de téléphone`;
}

export async function extractSeanceFromMessage(
  messageText: string,
  typesSeances: { id: string; nom: string }[],
  nowIso: string,
): Promise<ExtractionResult> {
  try {
    const trimmed = messageText.trim();
    if (!trimmed) {
      return { ok: false, error: "Message vide" };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[extract-seance] ANTHROPIC_API_KEY manquante");
      return {
        ok: false,
        error:
          "Extraction indisponible pour le moment. Réessayez ou remplissez le formulaire manuellement.",
      };
    }

    const allowedIds = new Set(typesSeances.map((t) => t.id));

    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 1024,
          thinking: { type: "disabled" },
          system: buildSystemPrompt(nowIso, typesSeances),
          messages: [{ role: "user", content: trimmed }],
        }),
      });
    } catch (networkErr) {
      console.error(
        "[extract-seance] réseau",
        networkErr instanceof Error ? networkErr.name : "unknown",
        "len=",
        trimmed.length,
      );
      return {
        ok: false,
        error:
          "Impossible de joindre le service d'extraction. Vérifiez votre connexion et réessayez.",
      };
    }

    if (!res.ok) {
      console.error("[extract-seance] Anthropic HTTP", res.status, "len=", trimmed.length);
      return {
        ok: false,
        error:
          res.status === 429
            ? "Le service d'extraction est saturé. Réessayez dans un instant."
            : "L'analyse du message a échoué. Réessayez ou remplissez le formulaire manuellement.",
      };
    }

    let data: {
      content?: Array<{ type?: string; text?: string }>;
      stop_reason?: string;
    };
    try {
      data = (await res.json()) as {
        content?: Array<{ type?: string; text?: string }>;
        stop_reason?: string;
      };
    } catch {
      console.error("[extract-seance] JSON HTTP invalide", "len=", trimmed.length);
      return {
        ok: false,
        error: "Réponse du service d'extraction illisible. Réessayez.",
      };
    }

    const rawText = textFromAnthropicContent(data.content);
    if (!rawText) {
      const types = (data.content ?? []).map((c) => c.type ?? "unknown").join(",");
      console.error(
        "[extract-seance] sans bloc texte",
        "len=",
        trimmed.length,
        "stop=",
        data.stop_reason ?? "n/a",
        "blocks=",
        types || "none",
      );
      return {
        ok: false,
        error: "Le service n'a renvoyé aucune analyse. Réessayez.",
      };
    }

    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: {
      patient?: Record<string, unknown>;
      seance?: Record<string, unknown>;
      confiance?: Record<string, unknown>;
    };
    try {
      parsed = JSON.parse(cleaned) as typeof parsed;
    } catch {
      console.error("[extract-seance] JSON.parse", "len=", trimmed.length);
      return {
        ok: false,
        error:
          "L'analyse n'a pas pu être interprétée. Réessayez ou passez en saisie manuelle.",
      };
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.patient ||
      typeof parsed.patient !== "object" ||
      !parsed.seance ||
      typeof parsed.seance !== "object"
    ) {
      console.error("[extract-seance] structure", "len=", trimmed.length);
      return {
        ok: false,
        error:
          "L'analyse est incomplète. Réessayez ou passez en saisie manuelle.",
      };
    }

    const confianceIn =
      parsed.confiance && typeof parsed.confiance === "object"
        ? parsed.confiance
        : {};

    let prenom = asNullableString(parsed.patient.prenom);
    let nom = asNullableString(parsed.patient.nom);
    let email = asNullableString(parsed.patient.email);
    let telephone = asNullableString(parsed.patient.telephone);
    let date = asNullableString(parsed.seance.date);
    let heure = asNullableString(parsed.seance.heure);
    let typeSeanceId = asNullableString(parsed.seance.type_seance_id);

    const confiance: ExtractionConfiance = {
      prenom: asBool(confianceIn.prenom),
      nom: asBool(confianceIn.nom),
      email: asBool(confianceIn.email),
      telephone: asBool(confianceIn.telephone),
      date: asBool(confianceIn.date),
      heure: asBool(confianceIn.heure),
      type_seance_id: asBool(confianceIn.type_seance_id),
    };

    if (email && !EMAIL_RE.test(email)) {
      email = null;
      confiance.email = false;
    }
    if (date && !validIsoDate(date)) {
      date = null;
      confiance.date = false;
    }
    heure = normalizeTime(heure);
    if (!heure) {
      confiance.heure = false;
    }
    if (typeSeanceId && !allowedIds.has(typeSeanceId)) {
      typeSeanceId = null;
      confiance.type_seance_id = false;
    }

    if (!prenom) confiance.prenom = false;
    if (!nom) confiance.nom = false;
    if (!email) confiance.email = false;
    if (!telephone) confiance.telephone = false;
    if (!date) confiance.date = false;
    if (!heure) confiance.heure = false;
    if (!typeSeanceId) confiance.type_seance_id = false;

    const hasAnything =
      Boolean(prenom) ||
      Boolean(nom) ||
      Boolean(email) ||
      Boolean(telephone) ||
      Boolean(date) ||
      Boolean(heure) ||
      Boolean(typeSeanceId);

    if (!hasAnything) {
      return {
        ok: false,
        error:
          "Aucune information exploitable n'a été détectée dans ce message. Réessayez avec plus de détails ou passez en saisie manuelle.",
      };
    }

    return {
      ok: true,
      patient: { prenom, nom, email, telephone },
      seance: { date, heure, type_seance_id: typeSeanceId },
      confiance,
    };
  } catch (err) {
    console.error(
      "[extract-seance]",
      err instanceof Error ? err.name : "unknown",
    );
    return {
      ok: false,
      error:
        "Une erreur inattendue s'est produite pendant l'analyse. Réessayez ou remplissez le formulaire manuellement.",
    };
  }
}
