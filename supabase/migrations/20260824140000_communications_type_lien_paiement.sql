-- Journal communications : type 'lien_paiement_manuel' (email lien de paiement
-- d'une séance créée manuellement).
-- Contrainte DEV constatée avant écriture :
--   CHECK (type = ANY (ARRAY[
--     'confirmation_reservation', 'confirmation_reservation_praticien',
--     'annulation_par_sophrologue_vers_client', 'annulation_par_sophrologue_vers_praticien',
--     'annulation_par_client_vers_client', 'annulation_par_client_vers_praticien',
--     'annulation_client', 'annulation_praticien', 'annulation',
--     'bienvenue_sophrologue', 'bienvenue_client',
--     'rappel_j1', 'post_seance', 'avis', 'limite_clients_alerte'
--   ]))
-- On conserve toutes les valeurs existantes et on ajoute 'lien_paiement_manuel'.
--
-- Colonne seances.token_paiement_manuel : token unique du lien de paiement
-- (page publique construite à l'étape 3/4).

ALTER TABLE communications DROP CONSTRAINT IF EXISTS communications_type_check;

ALTER TABLE communications
  ADD CONSTRAINT communications_type_check CHECK (
    type IN (
      'confirmation_reservation',
      'confirmation_reservation_praticien',
      'annulation_par_sophrologue_vers_client',
      'annulation_par_sophrologue_vers_praticien',
      'annulation_par_client_vers_client',
      'annulation_par_client_vers_praticien',
      -- Anciennes valeurs (lignes déjà en base)
      'annulation_client',
      'annulation_praticien',
      'annulation',
      'bienvenue_sophrologue',
      'bienvenue_client',
      'rappel_j1',
      'post_seance',
      'avis',
      'limite_clients_alerte',
      'lien_paiement_manuel'
    )
  );

ALTER TABLE seances
  ADD COLUMN IF NOT EXISTS token_paiement_manuel text;

COMMENT ON COLUMN seances.token_paiement_manuel IS
  'Token unique du lien de paiement pour une séance créée manuellement (origine = manuelle, règlement en ligne). NULL sinon.';

CREATE UNIQUE INDEX IF NOT EXISTS seances_token_paiement_manuel_uidx
  ON seances (token_paiement_manuel)
  WHERE token_paiement_manuel IS NOT NULL;
