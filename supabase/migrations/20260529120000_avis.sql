-- Avis clients (1 par séance) — token unique post-séance + modération sophrologue + affichage page publique

CREATE TABLE IF NOT EXISTS avis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sophrologue_id UUID NOT NULL REFERENCES sophrologues(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  seance_id UUID NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  token_expire_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  token_utilise BOOLEAN NOT NULL DEFAULT FALSE,
  note INTEGER CHECK (note BETWEEN 1 AND 5),
  commentaire TEXT,
  statut TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'approuve', 'rejete')),
  email_envoye BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT avis_unique_seance UNIQUE (seance_id)
);

-- ============================================================
-- Index
-- ============================================================
CREATE INDEX IF NOT EXISTS avis_token_idx ON avis (token);
CREATE INDEX IF NOT EXISTS avis_sophrologue_id_idx ON avis (sophrologue_id);
CREATE INDEX IF NOT EXISTS avis_statut_idx ON avis (statut);

-- ============================================================
-- Trigger updated_at (réutilise handle_updated_at)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_avis ON public.avis;
CREATE TRIGGER set_updated_at_avis
  BEFORE UPDATE ON public.avis
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE avis ENABLE ROW LEVEL SECURITY;

-- Sophrologue : lecture de ses propres avis
DROP POLICY IF EXISTS avis_select_sophrologue ON avis;
CREATE POLICY avis_select_sophrologue ON avis
  FOR SELECT
  TO authenticated
  USING (
    sophrologue_id = (SELECT id FROM sophrologues WHERE user_id = auth.uid())
  );

-- Public : lecture des avis approuvés (page publique, sans auth)
DROP POLICY IF EXISTS avis_select_public ON avis;
CREATE POLICY avis_select_public ON avis
  FOR SELECT
  TO anon, authenticated
  USING (statut = 'approuve');

-- INSERT réservé au service_role
DROP POLICY IF EXISTS avis_insert_service ON avis;
CREATE POLICY avis_insert_service ON avis
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- UPDATE réservé au service_role
DROP POLICY IF EXISTS avis_update_service ON avis;
CREATE POLICY avis_update_service ON avis
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Pas de policy DELETE : un avis ne doit jamais être supprimé.

COMMENT ON TABLE avis IS 'Avis clients par séance (token unique post-séance, modération sophrologue, affichage public si approuvé).';
