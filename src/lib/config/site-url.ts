export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SITE_URL is not defined");
  }
  return url.replace(/\/$/, ""); // enlève un éventuel trailing slash
}

export function getSophrologueUrl(
  departement: string,
  ville: string,
  slug: string,
): string {
  return `${getSiteUrl()}/sophrologues/${departement}/${ville}/${slug}`;
}
