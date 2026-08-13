-- Fondation sync Google Agenda V1 (Calymia → Google, one-way).
-- Tokens OAuth chiffrés en AES-256-GCM côté app (GOOGLE_TOKEN_ENCRYPTION_KEY),
-- jamais en clair. Accès table UNIQUEMENT via service_role (routes API).
-- Aucune policy authenticated/anon — volontaire, pas un oubli.

CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  sophrologue_id            uuid PRIMARY KEY
    REFERENCES public.sophrologues (id) ON DELETE CASCADE,
  google_email              text,
  refresh_token_enc         text,
  access_token_enc          text,
  access_token_expires_at   timestamptz,
  calendar_id               text,
  connected_at              timestamptz DEFAULT now(),
  last_synced_at            timestamptz,
  last_error                text,
  revoked_at                timestamptz,
  CHECK (revoked_at IS NOT NULL OR refresh_token_enc IS NOT NULL)
);

COMMENT ON TABLE public.google_calendar_connections IS
  'Connexion Google Agenda par sophrologue. Tokens AES-256-GCM (app). RLS sans policy : service_role uniquement.';

COMMENT ON COLUMN public.google_calendar_connections.refresh_token_enc IS
  'Refresh token Google chiffré (AES-256-GCM applicatif), jamais en clair.';

COMMENT ON COLUMN public.google_calendar_connections.access_token_enc IS
  'Access token Google chiffré (AES-256-GCM applicatif), jamais en clair.';

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.google_calendar_connections FROM PUBLIC;
REVOKE ALL ON TABLE public.google_calendar_connections FROM anon, authenticated;
GRANT ALL ON TABLE public.google_calendar_connections TO service_role;

ALTER TABLE public.seances
  ADD COLUMN IF NOT EXISTS google_event_id text;

COMMENT ON COLUMN public.seances.google_event_id IS
  'Id de l''événement Google Agenda miroir (calendrier Calymia). Null si non synchronisé.';

CREATE INDEX IF NOT EXISTS seances_google_event_id_idx
  ON public.seances (google_event_id)
  WHERE google_event_id IS NOT NULL;
