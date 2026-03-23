-- Champs vitrine cabinet (paramètres praticien)
ALTER TABLE sophrologues
  ADD COLUMN IF NOT EXISTS photos_cabinet TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS horaires JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS horaires_texte TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS infos_pratiques TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS modes_paiement TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS formations TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS certifications TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS syndicats TEXT[] DEFAULT '{}';

COMMENT ON COLUMN sophrologues.photos_cabinet IS 'URLs publiques des photos du cabinet (max 5 côté app).';
COMMENT ON COLUMN sophrologues.horaires IS 'Horaires structurés par jour (lundi–dimanche).';
COMMENT ON COLUMN sophrologues.modes_paiement IS 'Ex. cb, cheque, especes.';

-- Bucket photos cabinet : chemins {auth.uid()}/{filename}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cabinet-photos',
  'cabinet-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read cabinet-photos" ON storage.objects;
CREATE POLICY "Public read cabinet-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cabinet-photos');

DROP POLICY IF EXISTS "Sophrologue upload cabinet photos" ON storage.objects;
CREATE POLICY "Sophrologue upload cabinet photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cabinet-photos'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Sophrologue update cabinet photos" ON storage.objects;
CREATE POLICY "Sophrologue update cabinet photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cabinet-photos'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Sophrologue delete cabinet photos" ON storage.objects;
CREATE POLICY "Sophrologue delete cabinet photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'cabinet-photos'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
