import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ensures the public `avatars` bucket exists (Supabase Storage).
 * Call with a service-role client from API routes.
 */
export async function ensureAvatarsBucket(
  admin: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) {
    return { ok: false, error: listError.message };
  }
  if (buckets?.some((b) => b.name === "avatars")) {
    return { ok: true };
  }

  const { error: createError } = await admin.storage.createBucket("avatars", {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  });

  if (createError) {
    return { ok: false, error: createError.message };
  }
  return { ok: true };
}
