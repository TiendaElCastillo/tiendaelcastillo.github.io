-- Referral rewards are single-use per referred customer, even when a previous reward is reversed.
-- A referred customer can only qualify on orders created after the referral was linked.

drop index if exists private.wallet_referral_order_rewards_invitee_active_uidx;
create unique index if not exists wallet_referral_order_rewards_invitee_once_uidx
  on private.wallet_referral_order_rewards(invitee_user_id);

create or replace function private.apply_wallet_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_referrer uuid;
  v_created_at timestamptz;
  v_existing_code text;
  v_code text := upper(trim(coalesce(p_code,'')));
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para usar una invitación.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('castle-referral-link:' || v_uid::text,0)
  );

  select referral_code into v_existing_code
  from private.wallet_referrals
  where invitee_user_id = v_uid;

  if found then
    return jsonb_build_object(
      'linked',true,
      'already_linked',true,
      'message','Tu cuenta ya tiene una invitación vinculada. No hace falta introducir ningún código.'
    );
  end if;

  if v_code !~ '^[A-F0-9]{8}$' then
    raise exception 'El enlace de invitación no tiene un formato válido.';
  end if;

  select user_id into v_referrer
  from private.wallet_referral_codes
  where code = v_code;

  if not found then
    raise exception 'El enlace de invitación no existe o ya no está disponible.';
  end if;

  if v_referrer = v_uid then
    raise exception 'No puedes usar tu propio enlace de invitación.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_uid
      and role = 'customer'
  ) then
    raise exception 'Solo las cuentas de cliente pueden recibir una invitación.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_referrer
  ) then
    raise exception 'La cuenta que creó este enlace ya no está disponible.';
  end if;

  select created_at into v_created_at
  from auth.users
  where id = v_uid;

  if not found or v_created_at < now() - interval '7 days' then
    raise exception 'La invitación solo se puede vincular durante los primeros 7 días de una cuenta nueva.';
  end if;

  if exists (
    select 1
    from public.orders
    where user_id = v_uid
      and status = 'completed'
      and central_one_status = 'completed'
      and central_one_order_id is not null
  ) then
    raise exception 'La invitación debe abrirse y vincularse antes de completar la primera compra.';
  end if;

  insert into private.wallet_referrals(referrer_user_id,invitee_user_id,referral_code)
  values(v_referrer,v_uid,v_code);

  return jsonb_build_object(
    'linked',true,
    'already_linked',false,
    'message','Invitación vinculada automáticamente. La persona que te invitó recibirá el 5 % de tu primera compra creada desde ahora, cuando la recarga sea entregada.'
  );
end;
$function$;

create or replace function private.credit_wallet_referral_order_reward(p_order_id uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_referrer uuid;
  v_linked_at timestamptz;
  v_reward numeric(18,4);
  v_transaction_id uuid;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
     or v_order.status is distinct from 'completed'
     or v_order.central_one_status is distinct from 'completed'
     or v_order.central_one_order_id is null
     or v_order.payment_confirmed_at is null
     or coalesce(v_order.wallet_refund_amount,0) <= 0
     or exists (
       select 1
       from public.wallet_transactions wt
       where wt.order_id = p_order_id
         and wt.kind = 'refund'
         and wt.currency = 'USD'
     ) then
    return 0;
  end if;

  select referrer_user_id,linked_at
  into v_referrer,v_linked_at
  from private.wallet_referrals
  where invitee_user_id = v_order.user_id;

  if not found
     or v_referrer is null
     or v_referrer = v_order.user_id
     or v_linked_at is null
     or v_order.created_at < v_linked_at then
    return 0;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('castle-referral-first-purchase:' || v_order.user_id::text,0)
  );

  -- Never create another reward for this referred customer, even if an earlier
  -- reward was later reversed after the provider changed the delivery result.
  if exists (
    select 1
    from private.wallet_referral_order_rewards
    where invitee_user_id = v_order.user_id
  ) then
    return 0;
  end if;

  -- Only count qualifying deliveries from orders created after the invitation
  -- was linked. An older pending order cannot earn the inviter a commission.
  if exists (
    select 1
    from public.orders o
    where o.user_id = v_order.user_id
      and o.id <> p_order_id
      and o.created_at >= v_linked_at
      and o.created_at <= v_order.created_at
      and o.status = 'completed'
      and o.central_one_status = 'completed'
      and o.central_one_order_id is not null
  ) then
    return 0;
  end if;

  v_reward := round(v_order.wallet_refund_amount * 0.05,4);

  if v_reward <= 0 then
    return 0;
  end if;

  insert into public.wallet_transactions(
    user_id,order_id,kind,amount,currency,description
  )
  values (
    v_referrer,
    p_order_id,
    'adjustment',
    v_reward,
    'USD',
    'Recompensa de invitación del 5 % por la primera compra completada · pedido ' || coalesce(v_order.order_code,p_order_id::text)
  )
  returning id into v_transaction_id;

  insert into private.wallet_referral_order_rewards(
    order_id,referrer_user_id,invitee_user_id,package_amount_usd,
    reward_amount_usd,wallet_transaction_id
  )
  values (
    p_order_id,v_referrer,v_order.user_id,v_order.wallet_refund_amount,
    v_reward,v_transaction_id
  );

  return v_reward;
end;
$function$;
