-- Email post-séance (cron /api/cron/post-seance) : évite les doubles envois
ALTER TABLE seances
  ADD COLUMN IF NOT EXISTS post_seance_envoye BOOLEAN;

COMMENT ON COLUMN seances.post_seance_envoye IS 'Email de remerciement post-séance envoyé au patient (true). NULL/false = pas encore envoyé.';

-- Colonne utilisée par le cron (embed sophrologues) ; ajoutée si absente
ALTER TABLE sophrologues
  ADD COLUMN IF NOT EXISTS email_pro TEXT;

COMMENT ON COLUMN sophrologues.email_pro IS 'Email professionnel affiché / contexte praticien (optionnel).';
