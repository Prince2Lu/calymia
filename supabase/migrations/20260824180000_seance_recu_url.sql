-- Reçu PDF pour séances manuelles hors plateforme.
-- Document récapitulatif non fiscal — distinct de paiements.facture_url.

ALTER TABLE seances ADD COLUMN IF NOT EXISTS recu_url text;

COMMENT ON COLUMN seances.recu_url IS
  'URL du reçu PDF généré pour une séance manuelle hors plateforme. Document récapitulatif
   non fiscal, à ne jamais confondre avec une facture (paiements.facture_url) : le montant
   qui y figure est déclaratif, non vérifié par Calymia.';
