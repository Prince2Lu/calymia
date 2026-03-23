/** Shared Supabase Storage helpers for cabinet photos (`cabinet-photos` bucket). */

export const CABINET_PHOTOS_BUCKET = "cabinet-photos";
export const CABINET_MAX_PHOTOS = 5;
export const CABINET_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const CABINET_ACCEPT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type CabinetAcceptMime = (typeof CABINET_ACCEPT_TYPES)[number];

export function cabinetPhotoExtFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function storageObjectPathFromCabinetPublicUrl(
  publicUrl: string,
  supabaseUrl: string,
): string | null {
  const marker = `/storage/v1/object/public/${CABINET_PHOTOS_BUCKET}/`;
  const base = supabaseUrl.replace(/\/$/, "");
  const normalized = publicUrl.startsWith("http")
    ? publicUrl
    : `${base}${publicUrl.startsWith("/") ? "" : "/"}${publicUrl}`;
  const idx = normalized.indexOf(marker);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(normalized.slice(idx + marker.length));
  } catch {
    return null;
  }
}
