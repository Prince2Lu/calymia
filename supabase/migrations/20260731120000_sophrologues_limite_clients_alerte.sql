ALTER TABLE sophrologues ADD COLUMN IF NOT EXISTS limite_clients_alerte_envoyee_at TIMESTAMPTZ;
COMMENT ON COLUMN sophrologues.limite_clients_alerte_envoyee_at IS 'Date d''envoi de l''alerte de dépassement de la limite clients (plan Essentiel) — évite les envois répétés';
