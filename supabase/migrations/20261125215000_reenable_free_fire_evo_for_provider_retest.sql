-- Restore automatic publication of Free Fire EVO products after the supplier retest request.
-- Only publish the eight previously approved LATAM products when the latest provider
-- sync confirms active status, stock, player-ID validation and the expected target schema.
DO $migration$
DECLARE
  v_definition text;
  v_active_paused text := $paused$
    v_active := (v_status = 'active') and v_stock and v_supported
      and coalesce(v_sku,'') not ilike 'NIVEL-%'
      and v_name not ilike '%subida de nivel%'
      and v_name not ilike '%mejora de nivel%'
      and v_name not ilike '%fragmentos% evo%';
$paused$;
  v_active_original text := $original$
    v_active := (v_status = 'active') and v_stock and v_supported
      and coalesce(v_sku,'') not ilike 'NIVEL-%'
      and v_name not ilike '%subida de nivel%'
      and v_name not ilike '%mejora de nivel%';
$original$;
  v_return_paused text := $paused_return$
  update public.products
  set active = false, storefront_visible = false
  where game = 'Free Fire'
    and name ilike '%fragmentos% evo%';

  return jsonb_build_object(
    'ok', true,
    'synced', v_synced,
$paused_return$;
  v_return_original text := $original_return$
  return jsonb_build_object(
    'ok', true,
    'synced', v_synced,
$original_return$;
BEGIN
  SELECT pg_get_functiondef(
    'private.sync_free_fire_provider_products(text,jsonb,jsonb)'::regprocedure
  )
  INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'No se encontró la función de sincronización de Free Fire.';
  END IF;

  IF position(v_active_paused IN v_definition) > 0 THEN
    v_definition := replace(v_definition, v_active_paused, v_active_original);
  ELSIF position(v_active_original IN v_definition) = 0 THEN
    RAISE EXCEPTION 'La regla de activación de Free Fire cambió; no se modificó la función.';
  END IF;

  IF position(v_return_paused IN v_definition) > 0 THEN
    v_definition := replace(v_definition, v_return_paused, v_return_original);
  ELSIF position(v_return_original IN v_definition) = 0 THEN
    RAISE EXCEPTION 'No se pudo localizar el punto de salida de la sincronización; no se modificó la función.';
  END IF;

  EXECUTE v_definition;
END;
$migration$;

DO $publish$
DECLARE
  v_expected_ids uuid[] := array[
    '11251c9b-4966-4210-969e-3d4ffdfb70aa'::uuid, -- 1 caja
    'b1b110f9-45dc-4226-a2b2-f5c8041095af'::uuid, -- 5 cajas
    '5552cdf0-92e1-4358-9a5b-9f0e21e056a3'::uuid, -- 10 cajas
    'a7d58f19-3ace-49a8-be09-0e5edde9d448'::uuid, -- 50 cajas
    '51825a7b-68b0-4d1d-84e8-36367d316844'::uuid, -- 10 fragmentos
    'f6133c86-37cd-48af-8868-dc44cce482a8'::uuid, -- 50 fragmentos
    '64e90b95-ccf8-40da-9c4b-37e5e25e32d5'::uuid, -- 100 fragmentos
    'a9cfa9a9-2310-4167-bdb9-6740413660dc'::uuid  -- 500 fragmentos
  ];
  v_published_count integer;
BEGIN
  UPDATE public.products p
     SET active = true,
         storefront_visible = true
   WHERE p.id = ANY(v_expected_ids)
     AND p.game = 'Free Fire'
     AND p.provider_region = 'LATAM'
     AND p.provider_status = 'active'
     AND p.provider_in_stock IS TRUE
     AND p.provider_validation_supported IS TRUE
     AND p.provider_requires_target IS TRUE
     AND p.provider_target_fields = '["player_id"]'::jsonb
     AND jsonb_array_length(p.provider_target_schema) = 1
     AND p.provider_target_schema @> '[{"key":"player_id","type":"text"}]'::jsonb
     AND p.provider_synced_at >= now() - interval '30 minutes';

  GET DIAGNOSTICS v_published_count = ROW_COUNT;
  RAISE NOTICE 'Productos Free Fire EVO reactivados y visibles: % de % elegibles.', v_published_count, cardinality(v_expected_ids);
END;
$publish$;
