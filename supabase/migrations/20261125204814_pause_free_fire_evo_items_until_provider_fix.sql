-- Pause Free Fire EVO crates and weapon fragments until the provider confirms the correct player-validation / delivery flow.
-- Keep these products disabled across every future provider catalog refresh.
DO $migration$
DECLARE
  v_definition text;
  v_active_old text := $old$
    v_active := (v_status = 'active') and v_stock and v_supported
      and coalesce(v_sku,'') not ilike 'NIVEL-%'
      and v_name not ilike '%subida de nivel%'
      and v_name not ilike '%mejora de nivel%';
$old$;
  v_active_new text := $new$
    v_active := (v_status = 'active') and v_stock and v_supported
      and coalesce(v_sku,'') not ilike 'NIVEL-%'
      and v_name not ilike '%subida de nivel%'
      and v_name not ilike '%mejora de nivel%'
      and v_name not ilike '%fragmentos% evo%';
$new$;
  v_return_old text := $return_old$
  return jsonb_build_object(
    'ok', true,
    'synced', v_synced,
$return_old$;
  v_return_new text := $return_new$
  update public.products
  set active = false, storefront_visible = false
  where game = 'Free Fire'
    and name ilike '%fragmentos% evo%';

  return jsonb_build_object(
    'ok', true,
    'synced', v_synced,
$return_new$;
BEGIN
  SELECT pg_get_functiondef(
    'private.sync_free_fire_provider_products(text,jsonb,jsonb)'::regprocedure
  )
  INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'No se encontró la función de sincronización de Free Fire.';
  END IF;

  IF position(v_active_old IN v_definition) > 0 THEN
    v_definition := replace(v_definition, v_active_old, v_active_new);
  ELSIF position(v_active_new IN v_definition) = 0 THEN
    RAISE EXCEPTION 'La regla de activación de Free Fire cambió; no se modificó la función.';
  END IF;

  IF position(v_return_old IN v_definition) > 0 THEN
    v_definition := replace(v_definition, v_return_old, v_return_new);
  ELSIF position(v_return_new IN v_definition) = 0 THEN
    RAISE EXCEPTION 'No se pudo localizar el punto de salida de la sincronización; no se modificó la función.';
  END IF;

  EXECUTE v_definition;

  UPDATE public.products
  SET active = false, storefront_visible = false
  WHERE game = 'Free Fire'
    AND name ILIKE '%fragmentos% evo%';
END;
$migration$;
