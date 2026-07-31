-- Ajoute 'limite_clients_alerte' à communications_type_check
-- (utilisé par src/lib/notifications/limite-clients-alerte.ts)
-- Conserve 'avis' déjà présent en base (DEV/PROD) hors migration repo d'origine.

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
      'limite_clients_alerte'
    )
  );
