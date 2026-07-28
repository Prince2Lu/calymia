-- Vue publique pour le calcul de disponibilité (tunnel + badge prochain créneau).
-- Expose uniquement les colonnes non sensibles nécessaires à isSlotBooked().
-- Pas de policy SELECT sur public.seances : la vue est exécutée avec les droits du
-- propriétaire (postgres), ce qui permet de lire les lignes sous-jacentes sans
-- exposer patient_id, notes, lien_teleconsultation, etc.
-- security_invoker = false (défaut) : ne propage pas le rôle anon vers la table.

CREATE VIEW public.seances_disponibilite
WITH (security_invoker = false) AS
SELECT
  sophrologue_id,
  debut_at,
  fin_at,
  statut,
  expire_at
FROM public.seances
WHERE statut IN ('confirmee', 'en_attente');

GRANT SELECT ON public.seances_disponibilite TO anon, authenticated;

COMMENT ON VIEW public.seances_disponibilite IS
  'Créneaux occupés (confirmée/en_attente) pour calcul disponibilité publique — pas de PII.';
