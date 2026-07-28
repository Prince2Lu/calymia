-- Lecture publique du délai minimum de réservation (tunnel + badge prochain créneau).
-- La table ne contient que des paramètres métier non sensibles :
--   politique_annulation, delai_annulation_heures, paiement_type, acompte_pourcentage,
--   delai_min_reservation_heures, couleur_theme — pas de PII ni secrets.
-- La policy FOR ALL existante ("Sophrologues gèrent leurs paramètres") reste inchangée ;
-- Postgres OR les policies permissives SELECT : anon + sophrologue authentifié.

CREATE POLICY "Lecture publique du délai minimum de réservation"
  ON public.parametres_cabinet FOR SELECT
  USING (true);
