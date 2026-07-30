ALTER TABLE sophrologues ADD COLUMN IF NOT EXISTS siret TEXT;
COMMENT ON COLUMN sophrologues.siret IS 'SIRET du sophrologue (auto-entrepreneur ou société), optionnel, affiché sur la facture si renseigné';
