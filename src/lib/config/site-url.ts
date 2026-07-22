/** Normalise un segment d'URL (département, ville, slug). */
export function toPathSegment(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getSiteUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL (ou NEXT_PUBLIC_SITE_URL) is not defined",
    );
  }
  return url.replace(/\/$/, "");
}

export function getSophrologueUrl(
  departement: string,
  ville: string,
  slug: string,
): string {
  return `${getSiteUrl()}/sophrologues/${departement}/${ville}/${slug}`;
}

type SophrologueProfileUrlInput = {
  departement?: string | null;
  ville?: string | null;
  slug?: string | null;
};

/** URL publique calculée dynamiquement — jamais lue depuis la base. */
export function getSophrologueProfileUrl(
  sophrologue: SophrologueProfileUrlInput,
): string | null {
  const { departement, ville, slug } = sophrologue;
  if (!departement || !ville || !slug) return null;
  return getSophrologueUrl(
    toPathSegment(departement),
    toPathSegment(ville),
    toPathSegment(slug),
  );
}
