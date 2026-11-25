-- Pause every Free Fire EVO box/fragment product until Central One confirms support.
-- Keep the pause durable across subsequent provider synchronizations.
DO $migration$
DECLARE
  v_definition text;
  v_active_original text := $original$
    v_active := (v_status = 'active') and v_stock and v_supported
      and coalesce(v_sku,'') not ilike 'NIVEL-%'
      and v_name not ilike '%subida de nivel%'
      and v_name not ilike '%mejora de nivel%';
$original$;
  v_active_paused text := $paused$
    v_active := (v_status = 'active') and v_stock and v_supported
      and coalesce(v_sku,'') not ilike 'NIVEL-%'
      and v_name not ilike '%subida de nivel%'
      and v_name not ilike '%mejora de nivel%'
      and v_name not ilike '%evo%';
$paused$;
  v_return_original text := $return_original$
  return jsonb_build_object(
    'ok', true,
    'synced', v_synced,
$return_original$;
  v_return_paused text := $return_paused$
  update public.products
  set active = false,
      storefront_visible = false
  where game = 'Free Fire'
    and name ilike '%evo%';

  return jsonb_build_object(
    'ok', true,
    'synced', v_synced,
$return_paused$;
BEGIN
  SELECT pg_get_functiondef(
    'private.sync_free_fire_provider_products(text,jsonb,jsonb)'::regprocedure
  )
  INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'No se encontró la función de sincronización de Free Fire.';
  END IF;

  IF position(v_active_original IN v_definition) > 0 THEN
    v_definition := replace(v_definition, v_active_original, v_active_paused);
  ELSIF position(v_active_paused IN v_definition) = 0 THEN
    RAISE EXCEPTION 'La regla de activación de Free Fire cambió; no se modificó la función.';
  END IF;

  IF position(v_return_original IN v_definition) > 0 THEN
    v_definition := replace(v_definition, v_return_original, v_return_paused);
  ELSIF position(v_return_paused IN v_definition) = 0 THEN
    RAISE EXCEPTION 'No se pudo localizar el punto de salida de la sincronización; no se modificó la función.';
  END IF;

  EXECUTE v_definition;
END;
$migration$;

UPDATE public.products
SET active = false,
    storefront_visible = false
WHERE game = 'Free Fire'
  AND (
    name ILIKE '%evo%'
    OR id = ANY (ARRAY[
      '11251c9b-4966-4210-969e-3d4ffdfb70aa'::uuid,
      'b1b110f9-45dc-4226-a2b2-f5c8041095af'::uuid,
      '5552cdf0-92e1-4358-9a5b-9f0e21e056a3'::uuid,
      'a7d58f19-3ace-49a8-be09-0e5edde9d448'::uuid,
      '51825a7b-68b0-4d1d-84e8-36367d316844'::uuid,
      'f6133c86-37cd-48af-8868-dc44cce482a8'::uuid,
      '64e90b95-ccf8-40da-9c4b-37e5e25e32d5'::uuid,
      'a9cfa9a9-2310-4167-bdb9-6740413660dc'::uuid
    ])
  );
