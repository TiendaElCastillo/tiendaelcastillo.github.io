-- Publish only Free Fire LATAM Evo products that Central One currently
-- confirms as active, in stock and player-ID-validation compatible.
-- Do not expose the 500-fragment pack while the supplier reports no stock.
do $migration$
declare
  v_expected_ids uuid[] := array[
    '11251c9b-4966-4210-969e-3d4ffdfb70aa'::uuid, -- 1 caja
    'b1b110f9-45dc-4226-a2b2-f5c8041095af'::uuid, -- 5 cajas
    '5552cdf0-92e1-4358-9a5b-9f0e21e056a3'::uuid, -- 10 cajas
    'a7d58f19-3ace-49a8-be09-0e5edde9d448'::uuid, -- 50 cajas
    '51825a7b-68b0-4d1d-84e8-36367d316844'::uuid, -- 10 fragmentos
    'f6133c86-37cd-48af-8868-dc44cce482a8'::uuid, -- 50 fragmentos
    '64e90b95-ccf8-40da-9c4b-37e5e25e32d5'::uuid  -- 100 fragmentos
  ];
  v_eligible_count integer;
  v_updated_count integer;
begin
  select count(*)
    into v_eligible_count
  from public.products p
  where p.id = any(v_expected_ids)
    and p.game = 'Free Fire'
    and p.provider_region = 'LATAM'
    and p.active is true
    and p.provider_status = 'active'
    and p.provider_in_stock is true
    and p.provider_validation_supported is true
    and p.provider_requires_target is true
    and p.provider_target_fields = '["player_id"]'::jsonb
    and jsonb_array_length(p.provider_target_schema) = 1
    and p.provider_target_schema @> '[{"key":"player_id","type":"text"}]'::jsonb
    and p.provider_synced_at >= now() - interval '30 minutes';

  if v_eligible_count <> cardinality(v_expected_ids) then
    raise exception
      'No se publicaron los productos Evo: se esperaban % paquetes LATAM validados y con stock reciente, pero solo % cumplen las condiciones.',
      cardinality(v_expected_ids), v_eligible_count;
  end if;

  update public.products p
     set storefront_visible = true
   where p.id = any(v_expected_ids)
     and p.game = 'Free Fire'
     and p.provider_region = 'LATAM'
     and p.active is true
     and p.provider_status = 'active'
     and p.provider_in_stock is true
     and p.provider_validation_supported is true
     and p.provider_requires_target is true
     and p.provider_target_fields = '["player_id"]'::jsonb
     and jsonb_array_length(p.provider_target_schema) = 1
     and p.provider_target_schema @> '[{"key":"player_id","type":"text"}]'::jsonb
     and p.provider_synced_at >= now() - interval '30 minutes';

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> cardinality(v_expected_ids) then
    raise exception 'Publicación Evo incompleta: se actualizaron % de % productos.', v_updated_count, cardinality(v_expected_ids);
  end if;
end;
$migration$;
