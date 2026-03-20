-- Rappel J-1 (email) : évite les doubles envois depuis le cron /api/cron/rappels-j1
-- Note : une colonne `rappel_email_envoye` peut exister déjà (ex. route test) ;
--         migrer les TRUE vers rappel_envoye si besoin :
--   UPDATE seances SET rappel_envoye = true WHERE rappel_email_envoye = true;

ALTER TABLE seances
  ADD COLUMN IF NOT EXISTS rappel_envoye BOOLEAN;

COMMENT ON COLUMN seances.rappel_envoye IS 'Rappel J-1 envoyé au patient (true). NULL/false = pas encore envoyé.';
