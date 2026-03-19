-- Public bucket for sophrologue profile photos (vitrine).
-- You can also create the bucket manually in Supabase Dashboard → Storage → New bucket → name: avatars → Public.
-- Path pattern: {sophrologue_id}/{timestamp}_{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow anyone to read objects in this public bucket (for public URLs on the vitrine)
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated sophrologues may only write inside their own folder (folder name = sophrologues.id)
DROP POLICY IF EXISTS "Sophrologues insert own avatars" ON storage.objects;
CREATE POLICY "Sophrologues insert own avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (
      SELECT id::text FROM public.sophrologues WHERE user_id = auth.uid() LIMIT 1
    )
  );

DROP POLICY IF EXISTS "Sophrologues update own avatars" ON storage.objects;
CREATE POLICY "Sophrologues update own avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (
      SELECT id::text FROM public.sophrologues WHERE user_id = auth.uid() LIMIT 1
    )
  );

DROP POLICY IF EXISTS "Sophrologues delete own avatars" ON storage.objects;
CREATE POLICY "Sophrologues delete own avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = (
      SELECT id::text FROM public.sophrologues WHERE user_id = auth.uid() LIMIT 1
    )
  );
