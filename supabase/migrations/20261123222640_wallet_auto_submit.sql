-- Wallet-funded orders are submitted through the authenticated customer flow.
-- The Edge Function verifies the customer's JWT and calls these restricted RPCs
-- with service_role. The functions still verify ownership and the original ledger debit.
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


REVOKE ALL ON FUNCTION public.claim_central_one_wallet_order(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_central_one_wallet_order(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.refund_wallet_order_before_provider(p_order_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_order public.orders%rowtype;
  v_purchase public.wallet_transactions%rowtype;
  v_refund public.wallet_transactions%rowtype;
  v_reason text;
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'Operación interna no autorizada.';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo verificar la cuenta del cliente.';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos ese pedido.';
  END IF;

  IF v_order.status = 'cancelled'
     AND v_order.central_one_error_code = 'wallet_auto_refunded_before_provider'
     AND coalesce(v_order.central_one_response->'wallet_refund'->>'refunded','false') = 'true' THEN
    SELECT * INTO v_refund
    FROM public.wallet_transactions
    WHERE order_id = p_order_id
      AND user_id = p_user_id
      AND kind = 'refund'
      AND currency = 'USD'
    LIMIT 1;
    IF NOT FOUND OR v_order.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'El pedido indica una devolución, pero no encontramos el movimiento correcto.';
    END IF;
    RETURN jsonb_build_object(
      'ok',true,'already_processed',true,'refunded',true,
      'order_id',p_order_id,'order_code',v_order.order_code,
      'credited_amount',v_refund.amount,'currency',v_refund.currency
    );
  END IF;

  IF v_order.user_id IS DISTINCT FROM p_user_id
     OR v_order.payment_source IS DISTINCT FROM 'wallet'
     OR v_order.payment_method IS DISTINCT FROM 'Saldo de Tienda El Castillo'
     OR v_order.paid_at IS NULL
     OR v_order.status <> 'processing' THEN
    RAISE EXCEPTION 'No se pudo verificar el pago original de la billetera.';
  END IF;

  IF v_order.central_one_order_id IS NOT NULL
     OR v_order.central_one_reference_code IS NOT NULL
     OR v_order.central_one_request_id IS NOT NULL
     OR v_order.central_one_status NOT IN ('retryable','rejected')
     OR coalesce(v_order.central_one_response->>'preflight','') <> 'blocked'
     OR coalesce(v_order.central_one_response->>'no_provider_order_created','false') <> 'true' THEN
    RAISE EXCEPTION 'No podemos devolver automáticamente este pedido porque el resultado de la recarga no es concluyente.';
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
    RAISE EXCEPTION 'No encontramos el descuento original de la billetera.';
  END IF;

  v_reason := coalesce(v_order.central_one_error_code,'preflight_blocked');

  INSERT INTO public.wallet_transactions(
    user_id,order_id,kind,amount,currency,description
  )
  VALUES (
    p_user_id,p_order_id,'refund',v_purchase.amount,'USD',
    'Devolución automática: no se creó una orden del proveedor · pedido ' || v_order.order_code
  )
  ON CONFLICT (order_id)
    WHERE order_id IS NOT NULL AND kind = 'refund'
  DO NOTHING;

  SELECT * INTO v_refund
  FROM public.wallet_transactions
  WHERE order_id = p_order_id
    AND user_id = p_user_id
    AND kind = 'refund'
    AND currency = 'USD'
  LIMIT 1;

  IF NOT FOUND OR v_refund.amount IS DISTINCT FROM v_purchase.amount THEN
    RAISE EXCEPTION 'No se pudo verificar el abono automático. No se confirmó la devolución.';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      central_one_status = 'cancelled',
      central_one_error_code = 'wallet_auto_refunded_before_provider',
      central_one_error_message = 'No se pudo iniciar la recarga antes de crear una orden del proveedor. El saldo fue devuelto automáticamente.',
      central_one_checked_at = now(),
      central_one_response = coalesce(central_one_response,'{}'::jsonb) ||
        jsonb_build_object(
          'wallet_refund',
          jsonb_build_object(
            'refunded',true,
            'credited_amount',v_refund.amount,
            'currency','USD',
            'approved_by_admin',false,
            'reason',v_reason,
            'recorded_at',now()
          )
        )
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'ok',true,'refunded',true,
    'order_id',p_order_id,'order_code',v_order.order_code,
    'credited_amount',v_refund.amount,'currency',v_refund.currency,
    'reason',v_reason
  );
END;
$function$


REVOKE ALL ON FUNCTION public.refund_wallet_order_before_provider(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_wallet_order_before_provider(uuid,uuid) TO service_role;
