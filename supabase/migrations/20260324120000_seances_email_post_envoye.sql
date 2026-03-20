-- Alignement avec le cron /api/cron/post-seance (colonne email_post_envoye)
-- Si vous utilisiez déjà post_seance_envoye, migrer puis renommer ou dupliquer :
--   UPDATE seances SET email_post_envoye = post_seance_envoye WHERE email_post_envoye IS NULL;

ALTER TABLE seances
  ADD COLUMN IF NOT EXISTS email_post_envoye BOOLEAN;

COMMENT ON COLUMN seances.email_post_envoye IS 'Email post-séance envoyé au patient (true). NULL/false = pas encore envoyé.';
