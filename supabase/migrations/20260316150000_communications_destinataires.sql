-- Colonnes destinataire pour le journal communications (si absentes)
ALTER TABLE communications
  ADD COLUMN IF NOT EXISTS destinataire_email TEXT;

ALTER TABLE communications
  ADD COLUMN IF NOT EXISTS destinataire_nom TEXT;
