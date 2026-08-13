-- Opt-in d'affichage email / téléphone sur la page publique SEO.
-- DEFAULT false : les comptes existants restent masqués (comportement actuel).

ALTER TABLE public.sophrologues
  ADD COLUMN IF NOT EXISTS afficher_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS afficher_telephone boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sophrologues.afficher_email IS
  'Si true, sophrologues.email est affiché sur la page publique et dans le JSON-LD Person.';

COMMENT ON COLUMN public.sophrologues.afficher_telephone IS
  'Si true, sophrologues.telephone est affiché sur la page publique et dans le JSON-LD Person.';
