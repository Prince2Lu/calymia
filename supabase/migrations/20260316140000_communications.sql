-- Journal des communications (emails envoyés)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sophrologue_id UUID NOT NULL REFERENCES sophrologues(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  seance_id UUID REFERENCES seances(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  objet TEXT,
  contenu TEXT,
  statut TEXT NOT NULL DEFAULT 'envoye' CHECK (statut IN ('envoye', 'echec')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  destinataire_email TEXT,
  destinataire_nom TEXT
);

CREATE INDEX IF NOT EXISTS communications_sophrologue_sent_at_idx
  ON communications (sophrologue_id, sent_at DESC);

ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communications_sophrologue ON communications;
CREATE POLICY communications_sophrologue ON communications
  FOR ALL
  USING (
    sophrologue_id = (SELECT id FROM sophrologues WHERE user_id = auth.uid())
  )
  WITH CHECK (
    sophrologue_id = (SELECT id FROM sophrologues WHERE user_id = auth.uid())
  );
