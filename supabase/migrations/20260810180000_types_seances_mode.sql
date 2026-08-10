-- Mode présentiel / visio sur chaque type de séance.
-- DEFAULT 'presentiel' : aucune régression sur les types existants.

ALTER TABLE public.types_seances
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'presentiel';

ALTER TABLE public.types_seances
  DROP CONSTRAINT IF EXISTS types_seances_mode_check;

ALTER TABLE public.types_seances
  ADD CONSTRAINT types_seances_mode_check
  CHECK (mode IN ('presentiel', 'visio'));

COMMENT ON COLUMN public.types_seances.mode IS
  'Lieu de la séance : presentiel (cabinet) ou visio (lien envoyé après confirmation).';
