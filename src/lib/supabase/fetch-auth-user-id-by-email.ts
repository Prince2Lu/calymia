/**
 * Résout l’id auth.users pour un email (GoTrue admin API, service role).
 * Même logique que /api/auth/check-email (paramètre filter).
 */
export async function fetchAuthUserIdByEmail(
  normalizedEmail: string,
): Promise<string | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || !normalizedEmail) return null;

  const url = `${base}/auth/v1/admin/users?page=1&per_page=20&filter=${encodeURIComponent(normalizedEmail)}`;

  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!res.ok) {
    console.warn("[fetchAuthUserIdByEmail] GoTrue:", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as {
    users?: Array<{ id?: string; email?: string | null }>;
  };

  const match = (data.users ?? []).find(
    (u) => u.email?.trim().toLowerCase() === normalizedEmail,
  );
  return match?.id ?? null;
}
