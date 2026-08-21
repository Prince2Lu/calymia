-- Suppression de numero_rpps (champ erroné : réservé aux professions de santé réglementées,
-- ne concerne pas les sophrologues).
-- Ajout de certification_rncp : booléen simple, futur filtre d'annuaire sophrologues (V2).
-- Le détail (école, code RNCP, année) continue de vivre en texte libre dans le champ
-- formations existant (text[]) — pas de duplication.

ALTER TABLE sophrologues
  DROP COLUMN IF EXISTS numero_rpps;

ALTER TABLE sophrologues
  ADD COLUMN IF NOT EXISTS certification_rncp boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sophrologues.certification_rncp IS
  'Sophrologue déclare détenir une certification reconnue RNCP. Booléen simple (pas de code
   ni de détail structuré) — sert de filtre pour un futur annuaire, pas de critère de score
   profil. Le détail texte libre reste dans la colonne formations.';
