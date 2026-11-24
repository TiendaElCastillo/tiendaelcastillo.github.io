-- Recupera en el entorno de pruebas las funciones seguras de reserva automática de pedidos.

-- Los validadores privados solo son ejecutables dentro de las funciones protegidas.

CREATE OR REPLACE FUNCTION private.additional_game_target_schema_supported(p_fields jsonb, p_schema jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_field text;
  v_descriptor jsonb;
begin
  if jsonb_typeof(p_fields) <> 'array'
     or jsonb_array_length(p_fields) <> 1
     or jsonb_typeof(p_schema) <> 'array' then
    return false;
  end if;

  v_field := p_fields->>0;
  if v_field not in ('player_id','game_user_id') then
    return false;
  end if;

  if jsonb_array_length(p_schema) = 0 then
    return true;
  end if;
  if jsonb_array_length(p_schema) <> 1 then
    return false;
  end if;

  v_descriptor := p_schema->0;
  return v_descriptor->>'key' = v_field
     and lower(coalesce(v_descriptor->>'type','text')) = 'text'
     and lower(coalesce(v_descriptor->>'label','')) !~ '(password|contraseñ|correo|email|login|credential|access|token)';
end;
$function$


CREATE OR REPLACE FUNCTION private.mobile_legends_target_schema_supported(p_fields jsonb, p_schema jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE
  v_field text;
  v_descriptor jsonb;
  v_semantic text;
  v_player_count integer := 0;
  v_zone_count integer := 0;
BEGIN
  IF jsonb_typeof(p_fields) <> 'array'
     OR jsonb_array_length(p_fields) <> 2
     OR jsonb_typeof(p_schema) <> 'array'
     OR jsonb_array_length(p_schema) <> 2 THEN
    RETURN false;
  END IF;

  FOR v_field IN
    SELECT jsonb_array_elements_text(p_fields)
  LOOP
    IF v_field !~ '^[A-Za-z][A-Za-z0-9_]{0,39}$' THEN
      RETURN false;
    END IF;

    SELECT s.value INTO v_descriptor
    FROM jsonb_array_elements(p_schema) AS s(value)
    WHERE s.value->>'key' = v_field
    LIMIT 1;

    IF v_descriptor IS NULL
       OR coalesce(lower(v_descriptor->>'type'), 'text') <> 'text' THEN
      RETURN false;
    END IF;

    v_semantic := lower(v_field || ' ' || coalesce(v_descriptor->>'label',''));

    IF v_semantic ~ '(zone|server)' THEN
      v_zone_count := v_zone_count + 1;
    ELSIF v_semantic ~ '(player|user|account|game.?id|uid)' THEN
      v_player_count := v_player_count + 1;
    ELSE
      RETURN false;
    END IF;
  END LOOP;

  RETURN v_player_count = 1 AND v_zone_count = 1;
END;
$function$


CREATE OR REPLACE FUNCTION public.claim_central_one_order(p_order_id uuid, p_admin_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_key text;
  v_target_schema_supported boolean := false;
begin
  if p_admin_id is null or not exists (
    select 1 from public.profiles
    where id = p_admin_id and role = 'admin'
  ) then
    raise exception 'No tienes permiso para autorizar recargas.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'No encontramos ese pedido.'; end if;

  if v_order.central_one_order_id is not null then
    return jsonb_build_object(
      'claim_status','already_submitted',
      'provider_order_id',v_order.central_one_order_id,
      'reference_code',v_order.central_one_reference_code,
      'provider_status',v_order.central_one_status
    );
  end if;

  if v_order.status <> 'processing' then
    raise exception 'Primero debes confirmar el pago del cliente.';
  end if;

  if v_order.payment_source = 'direct' then
    if v_order.proof_path is null or v_order.payment_confirmed_at is null
       or v_order.payment_confirmed_by is distinct from p_admin_id then
      raise exception 'El pago externo no está confirmado con comprobante.';
    end if;
  elsif v_order.payment_source = 'wallet' then
    if v_order.paid_at is null then
      raise exception 'El pago desde la billetera no está confirmado.';
    end if;
  else
    raise exception 'Origen de pago no válido.';
  end if;

  if v_order.player_id_validated is distinct from true
     or v_order.player_id_validated_at is null
     or v_order.provider_product_id is null
     or v_order.provider_region is null then
    raise exception 'Este pedido no tiene una validación de jugador válida. No se enviará a Central One.';
  end if;

  select * into v_product
  from public.products
  where id = v_order.product_id;

  if not found or v_product.active is distinct from true
     or v_product.provider_product_id is distinct from v_order.provider_product_id
     or upper(coalesce(v_product.provider_region,'')) <> upper(coalesce(v_order.provider_region,''))
     or coalesce(v_product.provider_validation_supported,false) is distinct from true
     or lower(coalesce(v_product.provider_status,'')) <> 'active'
     or v_product.provider_in_stock is distinct from true then
    raise exception 'El paquete ya no está habilitado o disponible en Central One.';
  end if;

  if lower(coalesce(v_product.game,'')) = 'mobile legends: bang bang'
     and upper(coalesce(v_product.provider_region,'')) <> 'GLOBAL' then
    raise exception 'Mobile Legends solo se vende en la región GLOBAL. Este pedido no se enviará.';
  end if;

  if lower(coalesce(v_product.game,'')) = 'mobile legends: bang bang' then
    v_target_schema_supported := private.mobile_legends_target_schema_supported(
      v_product.provider_target_fields, v_product.provider_target_schema
    );
  else
    v_target_schema_supported := coalesce(
      private.additional_game_target_schema_supported(
        v_product.provider_target_fields, v_product.provider_target_schema
      ),
      false
    );
  end if;

  if coalesce(v_product.provider_requires_target,false) is distinct from true
     or not v_target_schema_supported then
    raise exception 'El formato de datos de jugador de este paquete cambió. La recarga quedó bloqueada para evitar un envío incorrecto.';
  end if;

  if v_order.central_one_status = 'submitting'
     and v_order.central_one_submitted_at > now() - interval '90 seconds' then
    return jsonb_build_object('claim_status','in_progress');
  end if;

  v_key := coalesce(
    v_order.central_one_idempotency_key,
    'EC_ORDER_' || replace(v_order.id::text, '-', '')
  );

  update public.orders
  set central_one_idempotency_key = v_key,
      central_one_status = 'submitting',
      central_one_submitted_at = now(),
      central_one_checked_at = now(),
      central_one_error_code = null,
      central_one_error_message = null
  where id = p_order_id;

  return jsonb_build_object(
    'claim_status','claimed',
    'order_id',v_order.id,
    'order_code',v_order.order_code,
    'provider_product_id',v_product.provider_product_id,
    'provider_region',v_product.provider_region,
    'provider_target_fields',v_product.provider_target_fields,
    'provider_target_schema',v_product.provider_target_schema,
    'player_id',v_order.player_id,
    'order_price',v_order.price,
    'payment_method',v_order.payment_method,
    'idempotency_key',v_key
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.claim_central_one_wallet_order(p_order_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_purchase public.wallet_transactions%rowtype;
  v_key text;
  v_target_schema_supported boolean := false;
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'Operación interna no autorizada.';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo verificar la cuenta que inició la compra.';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos ese pedido.';
  END IF;

  IF v_order.user_id IS DISTINCT FROM p_user_id
     OR v_order.payment_source IS DISTINCT FROM 'wallet'
     OR v_order.payment_method IS DISTINCT FROM 'Saldo de Tienda El Castillo' THEN
    RAISE EXCEPTION 'Este pedido no pertenece a tu billetera.';
  END IF;

  IF v_order.central_one_order_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'claim_status','already_submitted',
      'provider_order_id',v_order.central_one_order_id,
      'reference_code',v_order.central_one_reference_code,
      'provider_status',v_order.central_one_status
    );
  END IF;

  IF v_order.status <> 'processing'
     OR v_order.paid_at IS NULL
     OR v_order.payment_confirmed_at IS NULL
     OR v_order.payment_confirmed_by IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'El pago con saldo no está confirmado.';
  END IF;

  SELECT * INTO v_purchase
  FROM public.wallet_transactions
  WHERE order_id = p_order_id
    AND user_id = p_user_id
    AND kind = 'purchase'
    AND currency = 'USD'
    AND amount = v_order.price
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos el débito original de tu billetera.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.wallet_transactions
    WHERE order_id = p_order_id
      AND user_id = p_user_id
      AND kind = 'refund'
      AND currency = 'USD'
  ) THEN
    RAISE EXCEPTION 'El saldo de este pedido ya fue devuelto.';
  END IF;

  IF v_order.player_id_validated IS DISTINCT FROM true
     OR v_order.player_id_validated_at IS NULL
     OR v_order.provider_product_id IS NULL
     OR v_order.provider_region IS NULL THEN
    RAISE EXCEPTION 'Este pedido no tiene una validación de jugador vigente. No se enviará la recarga.';
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = v_order.product_id;

  IF NOT FOUND
     OR v_product.active IS DISTINCT FROM true
     OR v_product.provider_product_id IS DISTINCT FROM v_order.provider_product_id
     OR upper(coalesce(v_product.provider_region,'')) <> upper(coalesce(v_order.provider_region,''))
     OR coalesce(v_product.provider_validation_supported,false) IS DISTINCT FROM true
     OR lower(coalesce(v_product.provider_status,'')) <> 'active'
     OR v_product.provider_in_stock IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'El paquete ya no está habilitado o disponible. No se enviará la recarga.';
  END IF;

  IF lower(coalesce(v_product.game,'')) = 'mobile legends: bang bang'
     AND upper(coalesce(v_product.provider_region,'')) <> 'GLOBAL' THEN
    RAISE EXCEPTION 'Mobile Legends solo se vende en la región GLOBAL. Este pedido no se enviará.';
  END IF;

  IF lower(coalesce(v_product.game,'')) = 'mobile legends: bang bang' THEN
    v_target_schema_supported := private.mobile_legends_target_schema_supported(
      v_product.provider_target_fields, v_product.provider_target_schema
    );
  ELSE
    v_target_schema_supported := coalesce(
      private.additional_game_target_schema_supported(
        v_product.provider_target_fields, v_product.provider_target_schema
      ),
      false
    );
  END IF;

  IF coalesce(v_product.provider_requires_target,false) IS DISTINCT FROM true
     OR NOT v_target_schema_supported THEN
    RAISE EXCEPTION 'El formato de los datos del jugador cambió. La recarga quedó bloqueada para evitar un envío incorrecto.';
  END IF;

  IF v_order.central_one_status = 'submitting'
     AND v_order.central_one_submitted_at > now() - interval '90 seconds' THEN
    RETURN jsonb_build_object('claim_status','in_progress');
  END IF;

  v_key := coalesce(
    v_order.central_one_idempotency_key,
    'EC_ORDER_' || replace(v_order.id::text, '-', '')
  );

  UPDATE public.orders
  SET central_one_idempotency_key = v_key,
      central_one_status = 'submitting',
      central_one_submitted_at = now(),
      central_one_checked_at = now(),
      central_one_error_code = NULL,
      central_one_error_message = NULL
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'claim_status','claimed',
    'order_id',v_order.id,
    'order_code',v_order.order_code,
    'provider_product_id',v_product.provider_product_id,
    'provider_region',v_product.provider_region,
    'provider_target_fields',v_product.provider_target_fields,
    'provider_target_schema',v_product.provider_target_schema,
    'player_id',v_order.player_id,
    'order_price',v_order.price,
    'payment_method',v_order.payment_method,
    'idempotency_key',v_key
  );
END;
$function$


REVOKE ALL ON FUNCTION private.additional_game_target_schema_supported(jsonb,jsonb) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION private.mobile_legends_target_schema_supported(jsonb,jsonb) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.claim_central_one_order(uuid,uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_central_one_order(uuid,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.claim_central_one_wallet_order(uuid,uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_central_one_wallet_order(uuid,uuid) TO service_role;
