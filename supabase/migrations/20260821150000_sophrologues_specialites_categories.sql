ALTER TABLE sophrologues
  ADD COLUMN IF NOT EXISTS specialites_categories TEXT[] DEFAULT '{}';

COMMENT ON COLUMN sophrologues.specialites_categories IS
  'Catégories blog (1-3 max) déduites par classification Claude à partir de specialites (texte libre). Slugs parmi : pratique-quotidien, publics-specifiques, sante-mentale, sommeil, stress-anxiete, therapies-bien-etre.';
