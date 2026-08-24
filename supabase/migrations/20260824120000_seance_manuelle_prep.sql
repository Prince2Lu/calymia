-- Préparation création manuelle de séance (étape 1/4).
-- DEV only at apply time — ne pas pousser sur PROD tant que le code applicatif n'est pas prêt.
--
-- seances.origine : contrainte seances_origine_check déjà présente en DEV
--   CHECK (origine = ANY (ARRAY['en_ligne', 'manuelle']))
--   → aucune modification ( 'manuelle' est déjà autorisée ).

-- 1) Contact hors plateforme (WhatsApp/SMS) : email optionnel
ALTER TABLE patients ALTER COLUMN email DROP NOT NULL;

-- 2) Montant déclaré hors plateforme (informatif, hors commission)
ALTER TABLE seances
  ADD COLUMN IF NOT EXISTS montant_declare numeric(10,2);

COMMENT ON COLUMN seances.montant_declare IS
  'Montant déclaré par le sophrologue pour une séance réglée hors plateforme (espèces, chèque, CB en direct). Purement informatif — jamais vérifié, n''entre jamais dans le calcul de la commission Calymia. NULL si la séance est payée en ligne (le montant réel vient alors de paiements.montant_total).';
