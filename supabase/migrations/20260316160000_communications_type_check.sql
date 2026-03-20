-- Contrainte CHECK sur communications.type (valeurs autorisées)
-- Si la contrainte porte un autre nom en base, adaptez le DROP ou listez :
--   SELECT conname FROM pg_constraint WHERE conrelid = 'communications'::regclass;

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
      'post_seance'
    )
  );
