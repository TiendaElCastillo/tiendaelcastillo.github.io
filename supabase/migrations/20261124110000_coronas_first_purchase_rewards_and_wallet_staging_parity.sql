-- Tienda El Castillo: wallet/Coronas staging parity and referral rules.
-- This migration is intended for the isolated test project only.
-- It does not touch the production database or change real customer balances.

-- Bring the staging wallet/order metadata up to the shape used by the site.
alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null;

alter table public.products
  add column if not exists description text,
  add column if not exists amount integer,
  add column if not exists price_transfer numeric(18,4) default 0,
  add column if not exists price_mobile numeric(18,4) default 0,
  add column if not exists cost numeric(18,4) default 0,
  add column if not exists provider_product_id text,
  add column if not exists provider_sku text,
  add column if not exists provider_region text,
  add column if not exists provider_market text,
  add column if not exists provider_currency text,
  add column if not exists provider_cost numeric(18,4),
  add column if not exists provider_status text,
  add column if not exists provider_in_stock boolean,
  add column if not exists provider_requires_target boolean,
  add column if not exists provider_target_fields jsonb,
  add column if not exists provider_target_schema jsonb,
  add column if not exists provider_validation_supported boolean not null default false,
  add column if not exists provider_image_url text,
  add column if not exists provider_price_updated_at timestamptz,
  add column if not exists provider_synced_at timestamptz;

alter table public.orders
  add column if not exists player_id text,
  add column if not exists player_name text,
  add column if not exists provider_product_id text,
  add column if not exists provider_region text,
  add column if not exists player_id_validated boolean not null default false,
  add column if not exists player_id_validated_at timestamptz,
  add column if not exists player_id_validation_token uuid,
  add column if not exists wallet_request_id uuid,
  add column if not exists privacy_consent_at timestamptz,
  add column if not exists privacy_policy_version text,
  add column if not exists customer_rejection_reason text;

create unique index if not exists orders_wallet_request_id_uidx
  on public.orders(user_id, wallet_request_id)
  where wallet_request_id is not null;

create index if not exists orders_user_completed_first_purchase_idx
  on public.orders(user_id, created_at)
  where status = 'completed' and central_one_status = 'completed';

alter table public.wallet_deposits
  alter column status set default 'pending';

alter table public.wallet_deposit_proofs
  add column if not exists uploaded_at timestamptz not null default now();

create unique index if not exists wallet_deposit_proofs_deposit_path_uidx
  on public.wallet_deposit_proofs(deposit_id, proof_path);

create index if not exists wallet_referral_order_rewards_invitee_active_idx
  on private.wallet_referral_order_rewards(invitee_user_id)
  where reversed_at is null;

-- At most one active 5% reward per invited customer. A later successful order
-- can become eligible only after the earlier reward is properly reversed.
create unique index if not exists wallet_referral_order_rewards_one_active_per_invitee_uidx
  on private.wallet_referral_order_rewards(invitee_user_id)
  where reversed_at is null;

-- Wallet settings for the isolated staging project. The receiving address is
-- deliberately blank so no real USDT deposit address is exposed in tests.
create table if not exists public.wallet_settings (
  id smallint primary key default 1 check (id = 1),
  cup_per_usd numeric(18,4) not null default 1160 check (cup_per_usd > 0),
  usdt_network text not null default 'BNB Smart Chain (BEP20)',
  usdt_address text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.wallet_settings(id,cup_per_usd,usdt_network,usdt_address)
values(1,1160,'BNB Smart Chain (BEP20)','')
on conflict(id) do nothing;

alter table public.wallet_settings enable row level security;

drop policy if exists wallet_settings_read_authenticated on public.wallet_settings;
create policy wallet_settings_read_authenticated
  on public.wallet_settings for select to authenticated
  using (true);

drop policy if exists wallet_settings_admin_update on public.wallet_settings;
create policy wallet_settings_admin_update
  on public.wallet_settings for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

grant select, update on public.wallet_settings to authenticated;

-- Secure the staging tables with the same owner/admin access pattern as production.
alter table public.wallet_deposits enable row level security;
alter table public.wallet_deposit_proofs enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.orders enable row level security;
alter table public.profiles enable row level security;

drop policy if exists wallet_deposits_read_own_or_admin on public.wallet_deposits;
create policy wallet_deposits_read_own_or_admin
  on public.wallet_deposits for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists wallet_deposits_insert_own_pending on public.wallet_deposits;
create policy wallet_deposits_insert_own_pending
  on public.wallet_deposits for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and currency = 'CUP'
    and payment_method = 'Transferencia CUP'
    and proof_path is null
  );

drop policy if exists wallet_deposits_admin_update on public.wallet_deposits;
create policy wallet_deposits_admin_update
  on public.wallet_deposits for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists wallet_deposit_proofs_read_own_or_admin on public.wallet_deposit_proofs;
create policy wallet_deposit_proofs_read_own_or_admin
  on public.wallet_deposit_proofs for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists wallet_transactions_read_own_or_admin on public.wallet_transactions;
create policy wallet_transactions_read_own_or_admin
  on public.wallet_transactions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists wallet_transactions_admin_insert on public.wallet_transactions;
create policy wallet_transactions_admin_insert
  on public.wallet_transactions for insert to authenticated
  with check ((select private.is_admin()));

drop policy if exists orders_read_own_or_admin on public.orders;
create policy orders_read_own_or_admin
  on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read
  on public.profiles for select to authenticated
  using ((select private.is_admin()));

grant select, insert, update on public.wallet_deposits to authenticated;
grant select on public.wallet_deposit_proofs to authenticated;
grant select, insert on public.wallet_transactions to authenticated;
grant select on public.orders to authenticated;
grant select on public.profiles to authenticated;

-- A small, stable order-code fallback for the test project.
create or replace function private.assign_staging_order_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.order_code is null or btrim(new.order_code) = '' then
    new.order_code := 'TEC-' || upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,10));
  end if;
  return new;
end;
$function$;

drop trigger if exists orders_assign_staging_order_code on public.orders;
create trigger orders_assign_staging_order_code
before insert on public.orders
for each row execute function private.assign_staging_order_code();

-- Uploads are private, limited to 5 MB, and kept inside the customer's own
-- pending wallet deposit or direct order folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists customers_read_own_payment_proofs on storage.objects;
create policy customers_read_own_payment_proofs
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
    )
  );

drop policy if exists customers_upload_own_pending_payment_proofs on storage.objects;
create policy customers_upload_own_pending_payment_proofs
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (
      exists (
        select 1 from public.wallet_deposits d
        where d.id::text = (storage.foldername(name))[2]
          and d.user_id = (select auth.uid())
          and d.status in ('pending','payment_review')
      )
      or exists (
        select 1 from public.orders o
        where o.id::text = (storage.foldername(name))[2]
          and o.user_id = (select auth.uid())
          and o.status in ('pending','payment_review')
          and o.payment_source = 'direct'
      )
    )
  );

grant select, insert on storage.objects to authenticated;

-- Private wallet balance is always computed from the USD ledger.
create or replace function private.wallet_balance(
  p_user_id uuid,
  p_currency text default 'USD'
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(sum(
    case when kind in ('deposit','refund','adjustment') then amount else -amount end
  ),0)
  from public.wallet_transactions
  where user_id = p_user_id
    and currency = p_currency;
$function$;

-- Referral linking is restricted to a newly created account, before deposits
-- and before any earlier completed purchase. Self-referrals are rejected.
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
  v_code text := upper(trim(coalesce(p_code,'')));
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para usar una invitación.';
  end if;
  if v_code !~ '^[A-F0-9]{8}$' then
    raise exception 'El código de invitación no tiene un formato válido.';
  end if;

  select user_id into v_referrer
  from private.wallet_referral_codes
  where code = v_code;

  if not found then
    raise exception 'Ese código de invitación no existe.';
  end if;
  if v_referrer = v_uid then
    raise exception 'No puedes usar tu propio código de invitación.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('castle-referral-link:' || v_uid::text,0));

  select created_at into v_created_at
  from auth.users
  where id = v_uid;

  if not found or v_created_at < now() - interval '7 days' then
    raise exception 'El código solo se puede vincular durante los primeros 7 días de una cuenta nueva.';
  end if;

  if exists(select 1 from private.wallet_referrals where invitee_user_id = v_uid) then
    raise exception 'Esta cuenta ya tiene una invitación vinculada.';
  end if;

  if exists(select 1 from public.wallet_deposits where user_id = v_uid)
     or exists(
       select 1 from public.wallet_transactions
       where user_id = v_uid and kind = 'deposit' and currency = 'USD'
     ) then
    raise exception 'La invitación debe vincularse antes de solicitar la primera recarga de Coronas.';
  end if;

  if exists(
    select 1 from public.orders
    where user_id = v_uid
      and status = 'completed'
      and central_one_status = 'completed'
      and central_one_order_id is not null
  ) then
    raise exception 'La invitación debe vincularse antes de completar la primera compra.';
  end if;

  insert into private.wallet_referrals(referrer_user_id,invitee_user_id,referral_code)
  values(v_referrer,v_uid,v_code);

  return jsonb_build_object(
    'linked',true,
    'message','Invitación vinculada. La recompensa del 5 % se generará cuando completes tu primera compra.'
  );
exception
  when unique_violation then
    raise exception 'Esta cuenta ya tiene una invitación vinculada.';
end;
$function$;

-- The inviter receives 5% only for the invitee's first valid completed delivery.
-- Transaction locking and the partial unique index prevent concurrent/double pay.
create or replace function private.credit_wallet_referral_order_reward(p_order_id uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_referrer uuid;
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
     or exists(
       select 1 from public.wallet_transactions wt
       where wt.order_id = p_order_id
         and wt.kind = 'refund'
         and wt.currency = 'USD'
     ) then
    return 0;
  end if;

  select referrer_user_id into v_referrer
  from private.wallet_referrals
  where invitee_user_id = v_order.user_id;

  if not found or v_referrer is null or v_referrer = v_order.user_id then
    return 0;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('castle-referral-first-purchase:' || v_order.user_id::text,0));

  -- A reward already recorded for this order is never paid twice.
  if exists(
    select 1 from private.wallet_referral_order_rewards
    where order_id = p_order_id
  ) then
    return 0;
  end if;

  -- If an earlier purchase was already completed, this is not the first one.
  if exists(
    select 1 from public.orders o
    where o.user_id = v_order.user_id
      and o.id <> p_order_id
      and o.created_at <= v_order.created_at
      and o.status = 'completed'
      and o.central_one_status = 'completed'
      and o.central_one_order_id is not null
  ) then
    return 0;
  end if;

  -- One active reward per referred customer, even when two orders complete
  -- nearly simultaneously. A cancelled/refunded first completion is reversed.
  if exists(
    select 1 from private.wallet_referral_order_rewards r
    where r.invitee_user_id = v_order.user_id
      and r.reversed_at is null
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
  values(
    v_referrer,p_order_id,'adjustment',v_reward,'USD',
    'Recompensa de invitación del 5 % por la primera compra completada · pedido ' || coalesce(v_order.order_code,p_order_id::text)
  )
  returning id into v_transaction_id;

  insert into private.wallet_referral_order_rewards(
    order_id,referrer_user_id,invitee_user_id,package_amount_usd,
    reward_amount_usd,wallet_transaction_id
  )
  values(
    p_order_id,v_referrer,v_order.user_id,v_order.wallet_refund_amount,
    v_reward,v_transaction_id
  );

  return v_reward;
end;
$function$;

create or replace function private.wallet_referral_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_referrals integer := 0;
  v_rewarded integer := 0;
  v_rewarded_orders integer := 0;
  v_earned numeric(18,4) := 0;
  v_invite_linked boolean := false;
  v_applied_code text;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  v_code := private.ensure_wallet_referral_code();

  select count(*) into v_referrals
  from private.wallet_referrals
  where referrer_user_id = v_uid;

  select count(distinct invitee_user_id),
         count(*),
         coalesce(sum(reward_amount_usd),0)
  into v_rewarded,v_rewarded_orders,v_earned
  from private.wallet_referral_order_rewards
  where referrer_user_id = v_uid
    and reversed_at is null;

  select true,referral_code
  into v_invite_linked,v_applied_code
  from private.wallet_referrals
  where invitee_user_id = v_uid
  limit 1;

  return jsonb_build_object(
    'code',v_code,
    'referrals_count',v_referrals,
    'rewarded_count',v_rewarded,
    'referral_orders_count',v_rewarded_orders,
    'earned_usd',v_earned,
    'referral_percent',5,
    'reward_basis','first_successfully_completed_purchase',
    'invite_linked',coalesce(v_invite_linked,false),
    'applied_referral_code',v_applied_code
  );
end;
$function$;

create or replace function private.wallet_referral_admin_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_referrals integer := 0;
  v_rewarded integer := 0;
  v_earned numeric(18,4) := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'No autorizado.';
  end if;

  select count(*) into v_referrals
  from private.wallet_referrals;

  select count(distinct invitee_user_id),coalesce(sum(reward_amount_usd),0)
  into v_rewarded,v_earned
  from private.wallet_referral_order_rewards
  where reversed_at is null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'inviter_name',coalesce(nullif(btrim(inviter.full_name),''),inviter.email,'Cliente'),
        'invited_name',coalesce(nullif(btrim(invited.full_name),''),invited.email,'Cliente'),
        'referral_code',wr.referral_code,
        'linked_at',wr.linked_at,
        'order_code',latest.order_code,
        'reward_amount_usd',latest.reward_amount_usd,
        'reward_status',case
          when latest.order_id is null then 'Pendiente de primera compra'
          when latest.reversed_at is not null then 'Recompensa revertida'
          else 'Acreditada'
        end
      )
      order by wr.linked_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from private.wallet_referrals wr
  left join public.profiles inviter on inviter.id = wr.referrer_user_id
  left join public.profiles invited on invited.id = wr.invitee_user_id
  left join lateral (
    select r.order_id,r.reward_amount_usd,r.reversed_at,o.order_code
    from private.wallet_referral_order_rewards r
    left join public.orders o on o.id = r.order_id
    where r.invitee_user_id = wr.invitee_user_id
    order by r.rewarded_at desc
    limit 1
  ) latest on true;

  return jsonb_build_object(
    'referrals_count',v_referrals,
    'rewarded_count',v_rewarded,
    'earned_usd',v_earned,
    'referrals',v_rows
  );
end;
$function$;

-- Idempotent wallet checkout. The legacy payment_method value is retained in
-- the ledger/database so refunds and older orders remain compatible.
create or replace function private.create_wallet_order(
  p_product_id uuid,
  p_player_id text,
  p_player_name text default '',
  p_player_id_validation_token uuid default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_product public.products%rowtype;
  v_balance numeric;
  v_order public.orders%rowtype;
  v_price numeric(18,4);
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if p_request_id is null then
    raise exception 'No se pudo identificar esta compra. Vuelve a intentarlo.';
  end if;
  if length(btrim(coalesce(p_player_id,''))) < 3 or length(btrim(p_player_id)) > 64 then
    raise exception 'ID de jugador no válido.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));

  select * into v_order
  from public.orders
  where user_id = v_uid and wallet_request_id = p_request_id
  for update;

  if found then
    if v_order.product_id is distinct from p_product_id
       or v_order.player_id is distinct from btrim(p_player_id) then
      raise exception 'La clave de compra ya está asociada a otro pedido. Actualiza la página antes de repetir.';
    end if;

    return jsonb_build_object(
      'order_id',v_order.id,
      'order_code',v_order.order_code,
      'price',v_order.price,
      'currency','USD',
      'balance',private.wallet_balance(v_uid,'USD'),
      'status',v_order.status,
      'already_processed',true
    );
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
    and active is true
    and storefront_visible is true;

  if not found or coalesce(v_product.price_usdt,0) <= 0 then
    raise exception 'Paquete no disponible para pagar con Coronas.';
  end if;

  v_price := round(v_product.price_usdt,4);
  v_balance := private.wallet_balance(v_uid,'USD');

  if v_balance < v_price then
    raise exception 'Coronas insuficientes. Disponibles: % Coronas. Necesitas: % Coronas.',
      round(v_balance,4),v_price;
  end if;

  insert into public.orders(
    order_code,user_id,product_id,game,package_name,player_id,player_name,
    payment_method,payment_reference,price,status,payment_source,
    provider_product_id,provider_region,player_id_validation_token,
    player_id_validated,player_id_validated_at,wallet_request_id,
    paid_at,payment_confirmed_by,payment_confirmed_at
  )
  values(
    'TEC-' || upper(substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,10)),
    v_uid,v_product.id,v_product.game,v_product.name,btrim(p_player_id),btrim(coalesce(p_player_name,'')),
    'Saldo de Tienda El Castillo','',v_price,'pending','wallet',
    v_product.provider_product_id,v_product.provider_region,p_player_id_validation_token,
    p_player_id_validation_token is not null,
    case when p_player_id_validation_token is not null then now() else null end,
    p_request_id,now(),v_uid,now()
  )
  returning * into v_order;

  insert into public.wallet_transactions(user_id,order_id,kind,amount,currency,description)
  values(v_uid,v_order.id,'purchase',v_price,'USD','Compra del pedido ' || v_order.order_code);

  update public.orders
  set status = 'processing'
  where id = v_order.id and user_id = v_uid;

  return jsonb_build_object(
    'order_id',v_order.id,
    'order_code',v_order.order_code,
    'price',v_price,
    'currency','USD',
    'balance',private.wallet_balance(v_uid,'USD'),
    'status','processing',
    'already_processed',false
  );
end;
$function$;

-- Secure wallet proof intake. File paths must belong to the authenticated user,
-- be present in the private storage bucket, and cannot be claimed twice.
create or replace function private.submit_wallet_deposit_proofs(
  p_deposit_id uuid,
  p_proof_paths text[],
  p_reference text default null,
  p_sender_phone text default null,
  p_txid text default null,
  p_network text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_deposit public.wallet_deposits%rowtype;
  v_path text;
  v_reference text := nullif(upper(regexp_replace(btrim(coalesce(p_reference,'')),'[[:space:]]+','','g')),'');
  v_txid text := nullif(lower(btrim(coalesce(p_txid,''))),'');
  v_phone text := nullif(btrim(coalesce(p_sender_phone,'')),'');
  v_count integer := 0;
  v_inserted integer := 0;
  v_existing_proofs integer := 0;
  v_requested_proofs integer := 0;
  v_new_proofs integer := 0;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.';
  end if;
  if p_proof_paths is null or cardinality(p_proof_paths) < 1 or cardinality(p_proof_paths) > 2 then
    raise exception 'Adjunta entre 1 y 2 comprobantes.';
  end if;

  select count(distinct requested_path) into v_requested_proofs
  from unnest(p_proof_paths) as paths(requested_path);
  if v_requested_proofs <> cardinality(p_proof_paths) then
    raise exception 'No adjuntes la misma imagen más de una vez.';
  end if;

  select * into v_deposit
  from public.wallet_deposits
  where id = p_deposit_id and user_id = v_uid
  for update;
  if not found then
    raise exception 'No encontramos la recarga en tu cuenta.';
  end if;
  if v_deposit.status not in ('pending','payment_review') then
    raise exception 'Esta recarga ya no admite comprobantes.';
  end if;

  select count(distinct existing_path) into v_existing_proofs
  from (
    select wdp.proof_path as existing_path
    from public.wallet_deposit_proofs wdp
    where wdp.deposit_id = p_deposit_id and wdp.user_id = v_uid
    union all
    select wd.proof_path
    from public.wallet_deposits wd
    where wd.id = p_deposit_id and wd.user_id = v_uid and wd.proof_path is not null
  ) existing
  where existing_path is not null;

  select count(*) into v_new_proofs
  from (
    select requested_path
    from unnest(p_proof_paths) as paths(requested_path)
    except
    select existing_path
    from (
      select wdp.proof_path as existing_path
      from public.wallet_deposit_proofs wdp
      where wdp.deposit_id = p_deposit_id and wdp.user_id = v_uid
      union
      select wd.proof_path
      from public.wallet_deposits wd
      where wd.id = p_deposit_id and wd.user_id = v_uid and wd.proof_path is not null
    ) existing
    where existing_path is not null
  ) new_paths;

  if v_existing_proofs + v_new_proofs > 2 then
    raise exception 'Cada recarga admite un máximo de dos comprobantes en total.';
  end if;

  if v_deposit.payment_method = 'Transferencia CUP' then
    if v_reference is null or length(v_reference) < 3 or length(v_reference) > 100 then
      raise exception 'Escribe el número de transferencia del banco.';
    end if;
    if v_phone is null or v_phone !~ '^[+]?[0-9 ().-]{8,20}$'
       or length(regexp_replace(v_phone,'[^0-9]','','g')) not between 8 and 15 then
      raise exception 'Escribe el teléfono desde el que hiciste la transferencia.';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('castle-payment-reference:CUP:' || v_reference,0));

    if v_deposit.payment_reference is not null
       and upper(regexp_replace(v_deposit.payment_reference,'[[:space:]]+','','g')) <> v_reference then
      raise exception 'El número de transferencia ya quedó registrado en esta solicitud.';
    end if;

    if exists(
      select 1 from public.wallet_deposits d
      where d.id <> p_deposit_id
        and d.payment_method = 'Transferencia CUP'
        and upper(regexp_replace(coalesce(d.payment_reference,''),'[[:space:]]+','','g')) = v_reference
    ) then
      raise exception 'Ese número de transferencia ya fue utilizado en otra solicitud de recarga.';
    end if;

    if exists(
      select 1 from public.orders o
      where o.payment_method = 'Transferencia CUP'
        and upper(regexp_replace(coalesce(o.payment_reference,''),'[[:space:]]+','','g')) = v_reference
        and o.status in ('payment_review','processing','completed','rejected')
    ) then
      raise exception 'Ese número de transferencia ya fue utilizado en un pedido directo.';
    end if;

  elsif v_deposit.payment_method = 'USDT' then
    if v_txid is null or v_txid !~ '^[a-f0-9]{64}$' then
      raise exception 'El TxID debe tener 64 caracteres hexadecimales.';
    end if;
    if upper(coalesce(p_network,'')) not in ('BNB SMART CHAIN (BEP20)','BEP20') then
      raise exception 'La red debe ser BNB Smart Chain (BEP20).';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('castle-payment-reference:USDT:' || v_txid,0));

    if v_deposit.txid is not null and lower(v_deposit.txid) <> v_txid then
      raise exception 'El TxID ya quedó registrado en esta solicitud.';
    end if;
    if exists(
      select 1 from public.wallet_deposits d
      where d.id <> p_deposit_id and lower(coalesce(d.txid,'')) = v_txid
    ) then
      raise exception 'Ese TxID ya fue utilizado en otra solicitud de recarga.';
    end if;
    if exists(
      select 1 from public.orders o
      where o.payment_method = 'USDT'
        and lower(coalesce(o.payment_reference,'')) = v_txid
        and o.status in ('payment_review','processing','completed','rejected')
    ) then
      raise exception 'Ese TxID ya fue utilizado en un pedido directo.';
    end if;
  else
    raise exception 'Método de recarga no válido.';
  end if;

  foreach v_path in array p_proof_paths loop
    if v_path !~ ('^' || v_uid::text || '/' || p_deposit_id::text || '/[a-f0-9-]{36}[.](jpg|jpeg|png|webp)$') then
      raise exception 'La ruta de uno de los comprobantes no es válida.';
    end if;

    if not exists(
      select 1 from storage.objects so
      where so.bucket_id = 'payment-proofs' and so.name = v_path
    ) then
      raise exception 'No encontramos uno de los archivos subidos.';
    end if;

    insert into public.wallet_deposit_proofs(deposit_id,user_id,proof_path)
    values(p_deposit_id,v_uid,v_path)
    on conflict(deposit_id,proof_path) do nothing;

    get diagnostics v_inserted = row_count;
    v_count := v_count + v_inserted;
  end loop;

  update public.wallet_deposits
  set proof_path = coalesce(proof_path,p_proof_paths[1]),
      payment_reference = case when v_deposit.payment_method = 'Transferencia CUP' then v_reference else v_txid end,
      sender_phone = case when v_deposit.payment_method = 'Transferencia CUP' then v_phone else null end,
      txid = case when v_deposit.payment_method = 'USDT' then v_txid else null end,
      network = case when v_deposit.payment_method = 'USDT' then 'BNB Smart Chain (BEP20)' else null end,
      status = 'payment_review'
  where id = p_deposit_id and user_id = v_uid;

  return jsonb_build_object('deposit_id',p_deposit_id,'status','payment_review','proofs_received',v_count);
end;
$function$;

-- Public RPC entry points remain SECURITY INVOKER. Privileged work lives in
-- private SECURITY DEFINER functions with explicit auth checks and pinned paths.
create or replace function public.apply_wallet_referral_code(p_code text)
returns jsonb
language sql
set search_path = ''
as $function$
  select private.apply_wallet_referral_code($1);
$function$;

create or replace function public.get_wallet_referral_summary()
returns jsonb
language sql
set search_path = ''
as $function$
  select private.wallet_referral_summary();
$function$;

create or replace function public.get_wallet_referral_admin_summary()
returns jsonb
language sql
set search_path = ''
as $function$
  select private.wallet_referral_admin_summary();
$function$;

create or replace function public.create_wallet_order(
  p_product_id uuid,
  p_player_id text,
  p_player_name text default '',
  p_player_id_validation_token uuid default null,
  p_request_id uuid default null
)
returns jsonb
language sql
set search_path = ''
as $function$
  select private.create_wallet_order($1,$2,$3,$4,$5);
$function$;

create or replace function public.submit_wallet_deposit_proofs(
  p_deposit_id uuid,
  p_proof_paths text[],
  p_reference text default null,
  p_sender_phone text default null,
  p_txid text default null,
  p_network text default null
)
returns jsonb
language sql
set search_path = ''
as $function$
  select private.submit_wallet_deposit_proofs($1,$2,$3,$4,$5,$6);
$function$;

grant usage on schema private to authenticated;

revoke all on function private.apply_wallet_referral_code(text) from public, anon;
revoke all on function private.wallet_referral_summary() from public, anon;
revoke all on function private.wallet_referral_admin_summary() from public, anon;
revoke all on function private.create_wallet_order(uuid,text,text,uuid,uuid) from public, anon;
revoke all on function private.submit_wallet_deposit_proofs(uuid,text[],text,text,text,text) from public, anon;

grant execute on function private.apply_wallet_referral_code(text) to authenticated;
grant execute on function private.wallet_referral_summary() to authenticated;
grant execute on function private.wallet_referral_admin_summary() to authenticated;
grant execute on function private.create_wallet_order(uuid,text,text,uuid,uuid) to authenticated;
grant execute on function private.submit_wallet_deposit_proofs(uuid,text[],text,text,text,text) to authenticated;

revoke all on function public.apply_wallet_referral_code(text) from public, anon;
revoke all on function public.get_wallet_referral_summary() from public, anon;
revoke all on function public.get_wallet_referral_admin_summary() from public, anon;
revoke all on function public.create_wallet_order(uuid,text,text,uuid,uuid) from public, anon;
revoke all on function public.submit_wallet_deposit_proofs(uuid,text[],text,text,text,text) from public, anon;
revoke all on function public.admin_review_wallet_deposit(uuid,boolean,text) from public, anon;

grant execute on function public.apply_wallet_referral_code(text) to authenticated;
grant execute on function public.get_wallet_referral_summary() to authenticated;
grant execute on function public.get_wallet_referral_admin_summary() to authenticated;
grant execute on function public.create_wallet_order(uuid,text,text,uuid,uuid) to authenticated;
grant execute on function public.submit_wallet_deposit_proofs(uuid,text[],text,text,text,text) to authenticated;
grant execute on function public.admin_review_wallet_deposit(uuid,boolean,text) to authenticated;
