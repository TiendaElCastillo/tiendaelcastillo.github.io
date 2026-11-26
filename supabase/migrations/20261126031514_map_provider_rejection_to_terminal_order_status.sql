DO $migration$
DECLARE
  v_definition text;
  v_old text := $old$
  elsif p_provider_status = 'cancelled' then
    v_local_status := 'cancelled';
  end if;
$old$;
  v_new text := $new$
  elsif p_provider_status = 'cancelled' then
    v_local_status := 'cancelled';
  elsif p_provider_status = 'rejected' then
    v_local_status := 'rejected';
  end if;
$new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.finish_central_one_order(uuid,text,uuid,text,text,jsonb,text,text)'::regprocedure
  ) INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'No se encontró finish_central_one_order.';
  END IF;

  IF position(v_old IN v_definition) > 0 THEN
    v_definition := replace(v_definition, v_old, v_new);
  ELSIF position(v_new IN v_definition) = 0 THEN
    RAISE EXCEPTION 'La regla de estados cambió; no se modificó finish_central_one_order.';
  END IF;

  EXECUTE v_definition;
END;
$migration$;
