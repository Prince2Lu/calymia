-- Plans d'abonnement (Essentiel / Professionnel / Cabinet)
ALTER TABLE sophrologues
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'essentiel';

ALTER TABLE sophrologues DROP CONSTRAINT IF EXISTS sophrologues_plan_check;
ALTER TABLE sophrologues
  ADD CONSTRAINT sophrologues_plan_check
  CHECK (plan IN ('essentiel', 'professionnel', 'cabinet'));

-- Comptes existants : passer en Professionnel (évite de bloquer les tests en dev)
UPDATE sophrologues SET plan = 'professionnel' WHERE plan = 'essentiel';
