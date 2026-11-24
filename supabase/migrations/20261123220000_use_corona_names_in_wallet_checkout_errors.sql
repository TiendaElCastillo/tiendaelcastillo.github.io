-- El saldo interno se presenta al cliente como Coronas.
-- La contabilidad permanece en USD porque 1 Corona = 1 USD.
-- Esta función crea el pedido y registra el débito de forma atómica;
-- no llama a Central One ni envía la recarga al proveedor.

CREATE OR REPLACE FUNCTION private.create_wallet_order(
  p_product_id uuid,
  p_player_id text,
  p_player_name text DEFAULT ''::text,
  p_player_id_validation_token uuid DEFAULT NULL::uuid,
  p_request_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_product public.products%rowtype;
  v_balance numeric;
  v_order public.orders%rowtype;
  v_price numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo identificar esta compra. Vuelve a intentarlo.';
  END IF;
  IF length(trim(coalesce(p_player_id,''))) < 3 OR length(trim(p_player_id)) > 64 THEN
    RAISE EXCEPTION 'ID de jugador no válido.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text,0));

  SELECT * INTO v_order
  FROM public.orders
  WHERE user_id=v_uid AND wallet_request_id=p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_order.product_id IS DISTINCT FROM p_product_id OR v_order.player_id IS DISTINCT FROM trim(p_player_id) THEN
      RAISE EXCEPTION 'La clave de compra ya está asociada a otro pedido. Actualiza la página antes de repetir.';
    END IF;
    RETURN jsonb_build_object(
      'order_id',v_order.id,
      'order_code',v_order.order_code,
      'price',v_order.price,
      'currency','USD',
      'balance',private.wallet_balance(v_uid,'USD'),
      'status',v_order.status,
      'already_processed',true
    );
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id=p_product_id AND active=true;

  IF NOT FOUND OR coalesce(v_product.price_usdt,0)<=0 THEN
    RAISE EXCEPTION 'Paquete no disponible para pagar con Coronas.';
  END IF;

  v_price := v_product.price_usdt;
  v_balance := private.wallet_balance(v_uid,'USD');

  IF v_balance < v_price THEN
    RAISE EXCEPTION 'Coronas insuficientes. Disponibles: % Coronas. Necesitas: % Coronas.',
      round(v_balance,6),v_price;
  END IF;

  INSERT INTO public.orders(
    user_id,product_id,player_id,player_name,payment_method,payment_reference,status,payment_source,
    provider_product_id,provider_region,player_id_validation_token,wallet_request_id
  ) VALUES (
    v_uid,v_product.id,trim(p_player_id),trim(coalesce(p_player_name,'')),
    'Saldo de Tienda El Castillo','', 'pending','wallet',
    v_product.provider_product_id,v_product.provider_region,p_player_id_validation_token,p_request_id
  ) RETURNING * INTO v_order;

  INSERT INTO public.wallet_transactions(user_id,order_id,kind,amount,currency,description)
  VALUES(v_uid,v_order.id,'purchase',v_price,'USD','Compra del pedido '||v_order.order_code);

  UPDATE public.orders
  SET status='processing',paid_at=now(),payment_confirmed_by=v_uid,payment_confirmed_at=now()
  WHERE id=v_order.id AND user_id=v_uid;

  RETURN jsonb_build_object(
    'order_id',v_order.id,
    'order_code',v_order.order_code,
    'price',v_price,
    'currency','USD',
    'balance',private.wallet_balance(v_uid,'USD'),
    'status','processing',
    'already_processed',false
  );
END;
$function$;
