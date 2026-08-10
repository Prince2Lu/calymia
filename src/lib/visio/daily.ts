/**
 * Création d’une salle Daily.co pour une séance visio.
 * Ne jamais appeler hors d’un try/catch isolé (webhook / régénération).
 */

export async function createDailyRoom(finAt: string): Promise<string> {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) {
    throw new Error("DAILY_API_KEY manquante");
  }

  const finMs = new Date(finAt).getTime();
  if (Number.isNaN(finMs)) {
    throw new Error(`finAt invalide pour createDailyRoom: ${finAt}`);
  }

  // Expire 2h après la fin de séance
  const exp = Math.floor(finMs / 1000) + 2 * 60 * 60;

  const res = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { exp },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Daily.co HTTP ${res.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
    );
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url || typeof data.url !== "string") {
    throw new Error("Daily.co: réponse sans url");
  }

  return data.url;
}
