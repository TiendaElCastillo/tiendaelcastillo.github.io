-- Preserve the prepaid customer wallet and make its no-provider-order refund path safe.
-- The CLI migration generator is not installed in this workspace; review this file
-- against the live migration history before applying it to the hosted project.
--
-- Wallet business rules:
--   * CUP deposits are credited to the customer ledger only after admin verification.
--   * Wallet purchases use the published product price_usdt (USD-equivalent).
--   * A preflight-blocked wallet order may be refunded only when Central One
--     definitively did not create a provider order.
--   * Orders already created by Central One are refunded only by the separate
--     provider-confirmed refund function.

create or replace function private.validate_order_request()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  selected_product public.products%rowtype;
  final_price numeric;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'No autorizado para crear este pedido.';
  end if;

  if new.product_id is null then
    raise exception 'Selecciona un producto válido.';
  end if;

  if new.player_id is null or length(btrim(new.player_id)) < 3 or length(btrim(new.player_id)) > 64 then
    raise exception 'El ID del jugador debe tener entre 3 y 64 caracteres.';
  end if;

  select * into selected_product
  from public.products
  where id = new.product_id
    and active = true;

  if not found then
    raise exception 'El producto ya no está disponible.';
  end if;

  if selected_product.storefront_visible is distinct from true then
    raise exception 'Este paquete todavía no está publicado en Tienda El Castillo.';
  end if;

  if coalesce(new.payment_source, 'direct') = 'wallet' then
    if new.payment_method <> 'Saldo de Tienda El Castillo' then
      raise exception 'Método de billetera no válido.';
    end if;
    final_price := selected_product.price_usdt;
  elsif coalesce(new.payment_source, 'direct') = 'direct' then
    if not exists (
      select 1
      from public.payment_methods pm
      where pm.name = new.payment_method
        and pm.active = true
    ) then
      raise exception 'El método de pago no está activo.';
    end if;

    case new.payment_method
      when 'Transferencia CUP' then final_price := selected_product.price_transfer;
      when 'Saldo móvil' then final_price := selected_product.price_mobile;
      when 'USDT' then final_price := selected_product.price_usdt;
      else raise exception 'Método de pago no válido.';
    end case;
  else
    raise exception 'Origen de pago no válido.';
  end if;

  if final_price is null or final_price <= 0 then
    raise exception 'Este producto no tiene precio para ese método de pago.';
  end if;

  -- Rebuild every client-controlled order field from trusted product data.
  new.game := selected_product.game;
  new.package_name := selected_product.name;
  new.price := final_price;
  new.status := 'pending';
  new.order_code := 'EC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  new.player_id := btrim(new.player_id);
  new.player_name := nullif(btrim(coalesce(new.player_name, '')), '');
  new.payment_reference := null;
  new.payment_sender_phone := null;
  new.payment_reported_amount := null;
  new.admin_notes := null;
  new.created_at := now();
  new.payment_source := coalesce(new.payment_source, 'direct');
  new.proof_path := null;
  new.paid_at := null;

  -- Product identifiers are server-derived. The following validation trigger
  -- still checks and consumes the single-use token supplied by the wallet flow.
  new.provider_product_id := selected_product.provider_product_id;
  new.provider_region := selected_product.provider_region;
  new.player_id_validated := false;
  new.player_id_validated_at := null;

  -- These fields are written only by trusted admin/provider/server flows.
  new.payment_confirmed_by := null;
  new.payment_confirmed_at := null;
  new.central_one_idempotency_key := null;
  new.central_one_order_id := null;
  new.central_one_reference_code := null;
  new.central_one_status := 'not_submitted';
  new.central_one_request_id := null;
  new.central_one_error_code := null;
  new.central_one_error_message := null;
  new.central_one_submitted_at := null;
  new.central_one_checked_at := null;
  new.central_one_response := null;

  -- Only the dedicated wallet RPC may retain its idempotency key.
  if new.payment_source = 'direct' then
    new.wallet_request_id := null;
  end if;

  return new;
end;
$function$;


create or replace function public.admin_cancel_preflight_blocked_order(p_order_id uuid)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_order public.orders%rowtype;
  v_purchase public.wallet_transactions%rowtype;
  v_refund public.wallet_transactions%rowtype;
  v_provider_order_absent boolean := false;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Solo un administrador puede gestionar esta devolución.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'No encontramos ese pedido.';
  end if;

  -- Idempotent response after a successful wallet refund.
  if v_order.status = 'cancelled'
     and v_order.central_one_error_code = 'admin_cancelled_before_provider'
     and coalesce(v_order.central_one_response->'wallet_refund'->>'refunded', 'false') = 'true' then
    select * into v_refund
    from public.wallet_transactions
    where order_id = p_order_id
      and kind = 'refund'
      and currency = 'USD'
    limit 1;

    if not found then
      raise exception 'El pedido indica una devolución, pero no encontramos el movimiento contable.';
    end if;

    return jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'order_id', v_order.id,
      'order_code', v_order.order_code,
      'status', 'cancelled',
      'provider_order_created', false,
      'automatic_refund', true,
      'refunded', true,
      'credited_amount', v_refund.amount,
      'currency', v_refund.currency
    );
  end if;

  v_provider_order_absent :=
    v_order.central_one_order_id is null
    and v_order.central_one_reference_code is null
    and (
      (
        v_order.central_one_status = 'not_submitted'
        and v_order.central_one_request_id is null
        and v_order.central_one_submitted_at is null
      )
      or (
        v_order.central_one_status = 'retryable'
        and v_order.central_one_request_id is null
        and coalesce(v_order.central_one_response->>'preflight', '') = 'blocked'
        and coalesce(v_order.central_one_response->>'no_provider_order_created', 'false') = 'true'
      )
      or (
        v_order.central_one_status = 'rejected'
        and coalesce(v_order.central_one_response->>'no_provider_order_created', 'false') = 'true'
      )
    );

  if v_order.status <> 'processing' or not v_provider_order_absent then
    raise exception 'Este pedido no demuestra que Central One haya dejado la operación sin orden de proveedor. No se realizó ninguna devolución.';
  end if;

  if v_order.payment_source = 'wallet' then
    if v_order.payment_method <> 'Saldo de Tienda El Castillo' or v_order.paid_at is null then
      raise exception 'No se pudo verificar el débito original de la billetera.';
    end if;

    select * into v_purchase
    from public.wallet_transactions
    where order_id = p_order_id
      and user_id = v_order.user_id
      and kind = 'purchase'
      and currency = 'USD'
      and amount = v_order.price
    limit 1;

    if not found then
      raise exception 'No encontramos el débito original de la billetera. No se acreditó ninguna devolución.';
    end if;

    insert into public.wallet_transactions(
      user_id, order_id, kind, amount, currency, description
    )
    values (
      v_order.user_id,
      p_order_id,
      'refund',
      v_purchase.amount,
      'USD',
      'Devolución automática: Central One no creó una orden para el pedido ' || v_order.order_code
    )
    on conflict (order_id)
      where order_id is not null and kind = 'refund'
    do nothing;

    select * into v_refund
    from public.wallet_transactions
    where order_id = p_order_id
      and user_id = v_order.user_id
      and kind = 'refund'
      and currency = 'USD'
    limit 1;

    if not found or v_refund.amount <> v_purchase.amount then
      raise exception 'No se pudo verificar el movimiento de devolución. El pedido no se canceló.';
    end if;

    update public.orders
    set status = 'cancelled',
        central_one_status = 'cancelled',
        central_one_error_code = 'admin_cancelled_before_provider',
        central_one_error_message = 'Pedido cancelado antes de crear una orden en Central One. El saldo fue devuelto a la billetera del cliente.',
        central_one_checked_at = now(),
        central_one_response = coalesce(central_one_response, '{}'::jsonb) ||
          jsonb_build_object(
            'cancelled_before_provider', true,
            'cancelled_at', now(),
            'wallet_refund', jsonb_build_object(
              'refunded', true,
              'credited_amount', v_refund.amount,
              'currency', 'USD',
              'confirmed_by_provider', false,
              'reason', 'no_provider_order_created',
              'recorded_at', now()
            )
          ),
        admin_notes = concat_ws(
          E'\n',
          nullif(admin_notes, ''),
          'Cancelado antes del envío a Central One; el débito se devolvió a la billetera del cliente.'
        )
    where id = p_order_id;

    return jsonb_build_object(
      'ok', true,
      'order_id', v_order.id,
      'order_code', v_order.order_code,
      'status', 'cancelled',
      'provider_order_created', false,
      'automatic_refund', true,
      'refunded', true,
      'credited_amount', v_refund.amount,
      'currency', v_refund.currency
    );
  elsif v_order.payment_source = 'direct' then
    if v_order.payment_confirmed_at is not null or v_order.paid_at is not null then
      raise exception 'El pago externo ya fue confirmado. Debe completarse su devolución manual antes de cancelar el pedido.';
    end if;

    update public.orders
    set status = 'cancelled',
        central_one_status = 'cancelled',
        central_one_error_code = 'admin_cancelled_before_provider',
        central_one_error_message = 'Pedido anulado por el administrador antes de crear una orden en Central One. No se realizó una devolución automática.',
        central_one_checked_at = now(),
        central_one_response = coalesce(central_one_response, '{}'::jsonb) ||
          jsonb_build_object('cancelled_before_provider', true, 'cancelled_at', now()),
        admin_notes = concat_ws(
          E'\n',
          nullif(admin_notes, ''),
          'Anulado por administrador antes del envío a Central One; no se creó una orden del proveedor.'
        )
    where id = p_order_id;

    return jsonb_build_object(
      'ok', true,
      'order_id', v_order.id,
      'order_code', v_order.order_code,
      'status', 'cancelled',
      'provider_order_created', false,
      'automatic_refund', false,
      'refunded', false
    );
  end if;

  raise exception 'El origen de pago no admite esta operación.';
end;
$function$;

-- Wallet approvals, purchases, provider-confirmed refunds and this new
-- preflight refund all write to the existing USD ledger. No customer write
-- permission is added to wallet_transactions.

 
revoke all on function public.admin_cancel_preflight_blocked_order(uuid) from public, anon;
grant execute on function public.admin_cancel_preflight_blocked_order(uuid) to authenticated;
