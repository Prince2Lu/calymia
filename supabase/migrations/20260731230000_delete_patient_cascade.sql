-- Suppression atomique d'un patient cabinet + données liées (séances, paiements, etc.)
-- Appelée uniquement après vérif d'appartenance côté API (service_role / authenticated).

CREATE OR REPLACE FUNCTION public.delete_patient_cascade(p_patient_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_seance_ids uuid[];
  v_seances_count int;
BEGIN
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_seance_ids
  FROM seances
  WHERE patient_id = p_patient_id;

  v_seances_count := COALESCE(array_length(v_seance_ids, 1), 0);

  IF v_seances_count > 0 THEN
    DELETE FROM paiements WHERE seance_id = ANY (v_seance_ids);
    DELETE FROM communications WHERE seance_id = ANY (v_seance_ids);
  END IF;

  DELETE FROM communications WHERE patient_id = p_patient_id;
  DELETE FROM seance_notes WHERE patient_id = p_patient_id;

  IF v_seances_count > 0 THEN
    DELETE FROM seances WHERE id = ANY (v_seance_ids);
  END IF;

  DELETE FROM patients WHERE id = p_patient_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'patient_not_found';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'seances_supprimees', v_seances_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_patient_cascade(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_patient_cascade(uuid) TO service_role;
