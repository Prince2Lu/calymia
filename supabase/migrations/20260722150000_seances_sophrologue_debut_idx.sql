-- Accélère les requêtes agenda : filtre sophrologue_id + plage debut_at
CREATE INDEX IF NOT EXISTS seances_sophrologue_id_debut_at_idx
  ON public.seances (sophrologue_id, debut_at);
