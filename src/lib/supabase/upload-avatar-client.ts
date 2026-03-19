import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_BYTES = 5 * 1024 * 1024;

/** File name part after bucket: `{sophrologue_id}/{timestamp}_{safeOriginal}` */
export function buildAvatarStoragePath(
  sophrologueId: string,
  originalFileName: string,
): string {
  const safe =
    originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "avatar";
  return `${sophrologueId}/${Date.now()}_${safe}`;
}

/**
 * Upload an avatar image to the public `avatars` bucket using the user's session.
 * Requires Storage RLS policies (see `supabase/migrations/*_avatars_bucket.sql`).
 */
export async function uploadAvatarWithSession(
  supabase: SupabaseClient,
  sophrologueId: string,
  file: File,
): Promise<{ publicUrl: string } | { error: string }> {
  if (!file.type.startsWith("image/")) {
    return { error: "Veuillez choisir une image (JPG, PNG, WebP ou GIF)." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "L’image est trop volumineuse (maximum 5 Mo)." };
  }

  const path = buildAvatarStoragePath(sophrologueId, file.name);

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    });

  if (uploadError) {
    console.error("[uploadAvatarWithSession]", uploadError);
    return {
      error:
        uploadError.message ||
        "Échec du téléversement. Vérifiez la connexion et les droits Storage.",
    };
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}
