-- Notes de séance (1 par séance / praticien) — plans Professionnel & Cabinet côté app

CREATE TABLE IF NOT EXISTS seance_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sophrologue_id UUID NOT NULL REFERENCES sophrologues (id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  seance_id UUID NOT NULL REFERENCES seances (id) ON DELETE CASCADE,
  contenu_html TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sophrologue_id, seance_id)
);

CREATE INDEX IF NOT EXISTS seance_notes_seance_id_idx ON seance_notes (seance_id);
CREATE INDEX IF NOT EXISTS seance_notes_patient_id_idx ON seance_notes (patient_id);

ALTER TABLE seance_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sophrologue_own_notes ON seance_notes;

CREATE POLICY sophrologue_own_notes ON seance_notes
  FOR ALL
  TO authenticated
  USING (
    sophrologue_id IN (
      SELECT id FROM sophrologues WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    sophrologue_id IN (
      SELECT id FROM sophrologues WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE seance_notes IS 'Notes privées praticien par séance (RLS par sophrologue_id).';
