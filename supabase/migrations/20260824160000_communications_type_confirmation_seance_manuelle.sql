-- Journal communications : type 'confirmation_seance_manuelle'
-- (email de confirmation d'une séance créée manuellement, règlement hors plateforme).
--
-- Contrainte DEV attendue avant écriture (issue de
-- 20260824140000_communications_type_lien_paiement.sql, à recouper avec
-- pg_get_constraintdef si la base a divergé) :
--   CHECK (type = ANY (ARRAY[
--     'confirmation_reservation', 'confirmation_reservation_praticien',
--     'annulation_par_sophrologue_vers_client', 'annulation_par_sophrologue_vers_praticien',
--     'annulation_par_client_vers_client', 'annulation_par_client_vers_praticien',
--     'annulation_client', 'annulation_praticien', 'annulation',
--     'bienvenue_sophrologue', 'bienvenue_client',
--     'rappel_j1', 'post_seance', 'avis', 'limite_clients_alerte',
--     'lien_paiement_manuel'
--   ]))
-- On conserve toutes les valeurs existantes et on ajoute
-- 'confirmation_seance_manuelle'.

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
      'lien_paiement_manuel',
      'confirmation_seance_manuelle'
    )
  );
