-- Devuelve Coronas solo cuando se puede demostrar que el proveedor no recibió la orden.

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
  v_safe_preflight boolean := false;
  v_never_started boolean := false;
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

  v_safe_preflight :=
    v_order.central_one_status IN ('retryable','rejected')
    AND v_order.central_one_request_id IS NULL
    AND coalesce(v_order.central_one_response->>'preflight','') = 'blocked'
    AND coalesce(v_order.central_one_response->>'no_provider_order_created','false') = 'true';

  -- A database claim can fail before a provider submission is even started.
  -- Only refund this state when no provider identifiers, request id, idempotency
  -- key or submission timestamp were ever recorded.
  v_never_started :=
    v_order.central_one_status = 'not_submitted'
    AND v_order.central_one_request_id IS NULL
    AND v_order.central_one_submitted_at IS NULL
    AND v_order.central_one_idempotency_key IS NULL;

  IF v_order.central_one_order_id IS NOT NULL
     OR v_order.central_one_reference_code IS NOT NULL
     OR NOT (v_safe_preflight OR v_never_started) THEN
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
