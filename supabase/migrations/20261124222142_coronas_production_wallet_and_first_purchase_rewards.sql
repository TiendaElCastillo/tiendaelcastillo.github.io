
-- Tienda El Castillo: production-ready Coronas wallet, first-purchase referrals and automatic wallet orders.
-- Existing wallet transactions, deposit history, customer accounts and product catalogue are preserved.
-- New deposit methods remain manually approved; wallet purchases are dispatched automatically by the existing edge function.

-- 1) Enable all supported wallet recharge methods without changing historical rows.
alter table public.wallet_deposits
  drop constraint if exists wallet_deposits_currency_check;
alter table public.wallet_deposits
  add constraint wallet_deposits_currency_check
  check (currency = any (array['CUP'::text,'USDT'::text,'MOBILE'::text]));

alter table public.wallet_deposits
  drop constraint if exists wallet_deposits_payment_method_check;
alter table public.wallet_deposits
  add constraint wallet_deposits_payment_method_check
  check (payment_method = any (array['Transferencia CUP'::text,'USDT'::text,'Saldo móvil'::text]));

drop policy if exists "wallet deposits insert own pending" on public.wallet_deposits;
create policy "wallet deposits insert own pending"
  on public.wallet_deposits
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and proof_path is null
    and (
      (currency = 'CUP' and payment_method = 'Transferencia CUP')
      or (currency = 'USDT' and payment_method = 'USDT')
      or (currency = 'MOBILE' and payment_method = 'Saldo móvil')
    )
  );

create unique index if not exists wallet_deposits_mobile_reference_unique
  on public.wallet_deposits (
    upper(regexp_replace(trim(payment_reference),'[[:space:]]+','','g'))
  )
  where payment_method = 'Saldo móvil'
    and payment_reference is not null
    and trim(payment_reference) <> '';

-- 2) A single, safe settings RPC exposes only wallet recharge parameters.
create or replace function private.get_wallet_deposit_settings()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_settings public.wallet_settings%rowtype;
  v_rate numeric(18,4);
  v_mobile_units integer := 360;
  v_mobile_cost numeric(18,4) := 1200;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para consultar las formas de recarga.';
  end if;

  select * into v_settings
  from public.wallet_settings
  where id = 1;

  if not found then
    raise exception 'La configuración de Coronas no está disponible.';
  end if;

  v_rate := v_settings.cup_per_usd;

  if pg_catalog.to_regclass('public.pricing_settings') is not null then
    execute 'select usdt_cup_rate,mobile_credit_units,mobile_cost_cup
             from public.pricing_settings where id = 1'
      into v_rate,v_mobile_units,v_mobile_cost;
  else
    execute 'select mobile_credit_units,mobile_cost_cup
             from public.wallet_settings where id = 1'
      into v_mobile_units,v_mobile_cost;
  end if;

  return jsonb_build_object(
    'cup_per_usd',coalesce(v_rate,v_settings.cup_per_usd),
    'usdt_network',v_settings.usdt_network,
    'usdt_address',v_settings.usdt_address,
    'mobile_credit_units',coalesce(v_mobile_units,360),
    'mobile_cost_cup',coalesce(v_mobile_cost,1200)
  );
end;
$function$;

create or replace function public.get_wallet_deposit_settings()
returns jsonb
language sql
set search_path = ''
as $function$
  select private.get_wallet_deposit_settings();
$function$;

revoke all on function private.get_wallet_deposit_settings() from public, anon;
revoke all on function public.get_wallet_deposit_settings() from public, anon;
grant execute on function private.get_wallet_deposit_settings() to authenticated, service_role;
grant execute on function public.get_wallet_deposit_settings() to authenticated, service_role;

-- 3) Server-side conversion and validation for CUP, USDT BEP20 and mobile balance.
-- pricing_settings is used in production; the isolated test project stores the same values on wallet_settings.
create or replace function public.validate_wallet_deposit_request()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_settings public.wallet_settings%rowtype;
  v_rate numeric(18,4);
  v_mobile_units integer := 360;
  v_mobile_cost numeric(18,4) := 1200;
  v_units_per_corona numeric(18,6);
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'No autorizado para crear esta recarga.';
  end if;

  select * into v_settings
  from public.wallet_settings
  where id = 1;

  if not found then
    raise exception 'La configuración de Coronas no está disponible.';
  end if;

  v_rate := v_settings.cup_per_usd;

  if pg_catalog.to_regclass('public.pricing_settings') is not null then
    execute 'select usdt_cup_rate,mobile_credit_units,mobile_cost_cup
             from public.pricing_settings where id = 1'
      into v_rate,v_mobile_units,v_mobile_cost;
  else
    execute 'select mobile_credit_units,mobile_cost_cup
             from public.wallet_settings where id = 1'
      into v_mobile_units,v_mobile_cost;
  end if;

  v_rate := coalesce(v_rate,v_settings.cup_per_usd);
  v_mobile_units := coalesce(v_mobile_units,360);
  v_mobile_cost := coalesce(v_mobile_cost,1200);

  if v_rate is null or v_rate <= 0 then
    raise exception 'La tasa CUP por Corona no está configurada.';
  end if;

  if new.amount is null or new.amount <= 0 then
    raise exception 'El importe debe ser mayor que cero.';
  end if;

  if new.payment_method = 'Transferencia CUP' and new.currency = 'CUP' then
    if new.amount <> trunc(new.amount) then
      raise exception 'La transferencia CUP debe indicarse en pesos enteros.';
    end if;
    if new.amount < v_rate then
      raise exception 'La recarga mínima es 1 Corona: % CUP al cambio actual.', ceil(v_rate);
    end if;

    new.exchange_rate := v_rate;
    new.credited_amount := floor((new.amount / v_rate) * 100) / 100;
    new.network := null;
    new.txid := null;
    new.recipient_address := null;

  elsif new.payment_method = 'USDT' and new.currency = 'USDT' then
    if new.amount < 1 then
      raise exception 'La recarga mínima es 1 USDT, equivalente a 1 Corona.';
    end if;
    if lower(coalesce(v_settings.usdt_network,'')) not in ('bnb smart chain (bep20)','bep20')
       or coalesce(v_settings.usdt_address,'') !~* '^0x[a-f0-9]{40}$' then
      raise exception 'La recarga USDT no está configurada correctamente. No envíes fondos.';
    end if;

    new.exchange_rate := 1;
    new.credited_amount := floor(new.amount * 10000) / 10000;
    new.network := 'BNB Smart Chain (BEP20)';
    new.recipient_address := v_settings.usdt_address;

  elsif new.payment_method = 'Saldo móvil' and new.currency = 'MOBILE' then
    if new.amount <> trunc(new.amount) then
      raise exception 'El saldo móvil debe indicarse en unidades enteras.';
    end if;
    if v_mobile_units is null or v_mobile_units <= 0
       or v_mobile_cost is null or v_mobile_cost <= 0 then
      raise exception 'La conversión de saldo móvil no está configurada.';
    end if;

    v_units_per_corona := (v_mobile_units * v_rate) / v_mobile_cost;

    if new.amount < ceil(v_units_per_corona) then
      raise exception 'La recarga mínima es % unidades de saldo móvil, equivalentes a 1 Corona.', ceil(v_units_per_corona);
    end if;

    new.exchange_rate := v_units_per_corona;
    new.credited_amount := floor((new.amount / v_units_per_corona) * 100) / 100;
    new.network := null;
    new.txid := null;
    new.recipient_address := null;

  else
    raise exception 'Método o moneda de recarga no válido.';
  end if;

  if coalesce(new.credited_amount,0) < 1 then
    raise exception 'La recarga debe acreditar al menos 1 Corona.';
  end if;

  if not exists (
    select 1
    from public.payment_methods pm
    where pm.name = new.payment_method
      and pm.active is true
      and nullif(trim(pm.instructions),'') is not null
  ) then
    raise exception 'Este método de recarga no está habilitado o no tiene instrucciones.';
  end if;

  new.status := 'pending';
  new.proof_path := null;
  new.payment_reference := null;
  new.sender_phone := null;
  new.admin_notes := null;
  new.reviewed_at := null;
  new.reviewed_by := null;
  new.created_at := now();

  return new;
end;
$function$;

-- 4) Secure proof intake, including the ETECSA SMS path without a mandatory transaction reference.
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
  v_reference_scope text;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if p_proof_paths is null or cardinality(p_proof_paths) < 1 or cardinality(p_proof_paths) > 2 then
    raise exception 'Adjunta entre 1 y 2 comprobantes.';
  end if;

  select count(distinct requested_path)
  into v_requested_proofs
  from unnest(p_proof_paths) as paths(requested_path);

  if v_requested_proofs <> cardinality(p_proof_paths) then
    raise exception 'No adjuntes la misma imagen más de una vez.';
  end if;

  select * into v_deposit
  from public.wallet_deposits
  where id = p_deposit_id
    and user_id = v_uid
  for update;

  if not found then
    raise exception 'No encontramos la recarga en tu cuenta.';
  end if;

  if v_deposit.status not in ('pending','payment_review') then
    raise exception 'Esta recarga ya no admite comprobantes.';
  end if;

  select count(distinct existing_path)
  into v_existing_proofs
  from (
    select wdp.proof_path as existing_path
    from public.wallet_deposit_proofs wdp
    where wdp.deposit_id = p_deposit_id
      and wdp.user_id = v_uid
    union all
    select wd.proof_path
    from public.wallet_deposits wd
    where wd.id = p_deposit_id
      and wd.user_id = v_uid
      and wd.proof_path is not null
  ) existing
  where existing_path is not null;

  select count(*)
  into v_new_proofs
  from (
    select requested_path
    from unnest(p_proof_paths) as paths(requested_path)
    except
    select existing_path
    from (
      select wdp.proof_path as existing_path
      from public.wallet_deposit_proofs wdp
      where wdp.deposit_id = p_deposit_id
        and wdp.user_id = v_uid
      union
      select wd.proof_path
      from public.wallet_deposits wd
      where wd.id = p_deposit_id
        and wd.user_id = v_uid
        and wd.proof_path is not null
    ) existing
    where existing_path is not null
  ) new_paths;

  if v_existing_proofs + v_new_proofs > 2 then
    raise exception 'Cada recarga admite un máximo de dos comprobantes en total.';
  end if;

  if v_deposit.payment_method in ('Transferencia CUP','Saldo móvil') then
    if v_deposit.payment_method = 'Transferencia CUP'
       and (v_reference is null or length(v_reference) < 3 or length(v_reference) > 100) then
      raise exception 'Escribe el número de transferencia del banco.';
    end if;

    if v_reference is not null and (length(v_reference) < 3 or length(v_reference) > 100) then
      raise exception 'La referencia debe tener entre 3 y 100 caracteres.';
    end if;

    if v_phone is null or v_phone !~ '^[+]?[0-9 ().-]{8,20}$'
       or length(regexp_replace(v_phone,'[^0-9]','','g')) not between 8 and 15 then
      raise exception 'Escribe el teléfono desde el que enviaste el pago.';
    end if;

    if v_reference is not null then
      v_reference_scope := case
        when v_deposit.payment_method = 'Transferencia CUP' then 'CUP'
        else 'MOBILE'
      end;

      perform pg_advisory_xact_lock(
        hashtextextended('castle-payment-reference:' || v_reference_scope || ':' || v_reference,0)
      );

      if v_deposit.payment_reference is not null
         and upper(regexp_replace(v_deposit.payment_reference,'[[:space:]]+','','g')) <> v_reference then
        raise exception 'La referencia ya quedó registrada en esta solicitud.';
      end if;

      if exists (
        select 1
        from public.wallet_deposits d
        where d.id <> p_deposit_id
          and d.payment_method = v_deposit.payment_method
          and upper(regexp_replace(coalesce(d.payment_reference,''),'[[:space:]]+','','g')) = v_reference
      ) then
        raise exception 'Esa referencia ya fue utilizada en otra solicitud de recarga.';
      end if;

      if exists (
        select 1
        from public.orders o
        where o.payment_method = v_deposit.payment_method
          and upper(regexp_replace(coalesce(o.payment_reference,''),'[[:space:]]+','','g')) = v_reference
          and o.status in ('payment_review','processing','completed','rejected')
      ) then
        raise exception 'Esa referencia ya fue utilizada en un pedido directo.';
      end if;
    end if;

  elsif v_deposit.payment_method = 'USDT' then
    if v_txid is null or v_txid !~ '^[a-f0-9]{64}$' then
      raise exception 'El TxID debe tener 64 caracteres hexadecimales.';
    end if;

    if upper(coalesce(p_network,'')) not in ('BNB SMART CHAIN (BEP20)','BEP20') then
      raise exception 'La red debe ser BNB Smart Chain (BEP20).';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended('castle-payment-reference:USDT:' || v_txid,0)
    );

    if v_deposit.txid is not null and lower(v_deposit.txid) <> v_txid then
      raise exception 'El TxID ya quedó registrado en esta solicitud.';
    end if;

    if exists (
      select 1 from public.wallet_deposits d
      where d.id <> p_deposit_id
        and lower(coalesce(d.txid,'')) = v_txid
    ) then
      raise exception 'Ese TxID ya fue utilizado en otra solicitud de recarga.';
    end if;

    if exists (
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

    if not exists (
      select 1 from storage.objects so
      where so.bucket_id = 'payment-proofs'
        and so.name = v_path
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
      payment_reference = case when v_deposit.payment_method = 'USDT' then v_txid else v_reference end,
      sender_phone = case when v_deposit.payment_method in ('Transferencia CUP','Saldo móvil') then v_phone else null end,
      txid = case when v_deposit.payment_method = 'USDT' then v_txid else null end,
      network = case when v_deposit.payment_method = 'USDT' then 'BNB Smart Chain (BEP20)' else null end,
      status = 'payment_review'
  where id = p_deposit_id
    and user_id = v_uid;

  return jsonb_build_object(
    'deposit_id',p_deposit_id,
    'status','payment_review',
    'proofs_received',v_count
  );
end;
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

-- 5) Approval is always manual. First approved recharge receives 3% with no cap.
create or replace function public.admin_review_wallet_deposit(
  p_deposit_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_deposit public.wallet_deposits%rowtype;
  v_note text := nullif(trim(coalesce(p_note,'')),'');
  v_has_previous_deposit boolean := false;
  v_welcome_bonus numeric(14,4) := 0;
begin
  if not private.is_admin() then
    raise exception 'No autorizado.';
  end if;

  if p_approve is null then
    raise exception 'Selecciona aprobar o rechazar.';
  end if;

  select * into v_deposit
  from public.wallet_deposits
  where id = p_deposit_id
  for update;

  if not found then
    raise exception 'Recarga no encontrada.';
  end if;

  if v_deposit.status <> 'payment_review' then
    raise exception 'La recarga debe estar en revisión y no puede acreditarse dos veces.';
  end if;

  if not exists (
    select 1 from public.wallet_deposit_proofs p
    where p.deposit_id = p_deposit_id
  ) then
    raise exception 'No hay comprobantes asociados a esta recarga.';
  end if;

  if p_approve then
    if coalesce(v_deposit.credited_amount,0) < 1 then
      raise exception 'El importe a acreditar no cumple el mínimo de 1 Corona.';
    end if;

    if v_deposit.payment_method = 'Transferencia CUP'
       and (v_deposit.payment_reference is null or v_deposit.sender_phone is null) then
      raise exception 'Faltan los datos de verificación de la transferencia CUP.';
    end if;

    if v_deposit.payment_method = 'Saldo móvil'
       and v_deposit.sender_phone is null then
      raise exception 'Falta el teléfono de origen del saldo móvil.';
    end if;

    if v_deposit.payment_method = 'USDT'
       and (
         v_deposit.txid is null
         or v_deposit.txid !~ '^[a-f0-9]{64}$'
         or v_deposit.network <> 'BNB Smart Chain (BEP20)'
         or coalesce(v_deposit.recipient_address,'') !~* '^0x[a-f0-9]{40}$'
       ) then
      raise exception 'La información de red, dirección o TxID no es válida.';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended('castle-wallet-first-deposit:' || v_deposit.user_id::text,0)
    );

    select exists (
      select 1
      from public.wallet_transactions
      where user_id = v_deposit.user_id
        and kind = 'deposit'
        and currency = 'USD'
    ) into v_has_previous_deposit;

    if not v_has_previous_deposit then
      v_welcome_bonus := round(v_deposit.credited_amount * 0.03,4);
    end if;

    insert into public.wallet_transactions(
      user_id,deposit_id,kind,amount,currency,description
    )
    values (
      v_deposit.user_id,
      p_deposit_id,
      'deposit',
      v_deposit.credited_amount + v_welcome_bonus,
      'USD',
      case
        when v_welcome_bonus > 0 then
          case
            when v_deposit.payment_method = 'Transferencia CUP' then 'Primera recarga CUP aprobada + bono del 3 % sin límite'
            when v_deposit.payment_method = 'Saldo móvil' then 'Primera recarga de saldo móvil aprobada + bono del 3 % sin límite'
            else 'Primera recarga USDT BEP20 aprobada + bono del 3 % sin límite'
          end
        else
          case
            when v_deposit.payment_method = 'Transferencia CUP' then 'Recarga por transferencia CUP aprobada'
            when v_deposit.payment_method = 'Saldo móvil' then 'Recarga de saldo móvil aprobada'
            else 'Recarga USDT BEP20 aprobada'
          end
      end
    );

    update public.wallet_deposits
    set status = 'approved',
        welcome_bonus_amount = v_welcome_bonus,
        admin_notes = nullif(v_note,''),
        reviewed_at = now(),
        reviewed_by = auth.uid()
    where id = p_deposit_id;
  else
    if v_note is null or length(v_note) < 5 then
      raise exception 'Es obligatorio explicar el motivo del rechazo (mínimo 5 caracteres).';
    end if;

    update public.wallet_deposits
    set status = 'rejected',
        admin_notes = v_note,
        reviewed_at = now(),
        reviewed_by = auth.uid()
    where id = p_deposit_id;
  end if;

  return jsonb_build_object(
    'deposit_id',p_deposit_id,
    'status',case when p_approve then 'approved' else 'rejected' end,
    'credited_amount',case when p_approve then v_deposit.credited_amount else 0 end,
    'welcome_bonus_amount',case when p_approve then v_welcome_bonus else 0 end,
    'referral_bonus_amount',0
  );
end;
$function$;

-- 6) One 5% reward per referred customer: paid after the first provider delivery completes.
create table if not exists private.wallet_referral_order_rewards (
  order_id uuid primary key references public.orders(id) on delete restrict,
  referrer_user_id uuid not null references auth.users(id) on delete restrict,
  invitee_user_id uuid not null references auth.users(id) on delete restrict,
  package_amount_usd numeric(18,4) not null check (package_amount_usd > 0),
  reward_amount_usd numeric(18,4) not null check (reward_amount_usd > 0),
  wallet_transaction_id uuid not null unique references public.wallet_transactions(id) on delete restrict,
  rewarded_at timestamptz not null default now(),
  reversed_transaction_id uuid unique references public.wallet_transactions(id) on delete restrict,
  reversed_at timestamptz,
  check (
    (reversed_at is null and reversed_transaction_id is null)
    or (reversed_at is not null and reversed_transaction_id is not null)
  )
);

alter table private.wallet_referral_order_rewards enable row level security;
revoke all on table private.wallet_referral_order_rewards from public, anon, authenticated;

create index if not exists wallet_referral_order_rewards_referrer_idx
  on private.wallet_referral_order_rewards(referrer_user_id,rewarded_at desc);
create index if not exists wallet_referral_order_rewards_invitee_idx
  on private.wallet_referral_order_rewards(invitee_user_id,rewarded_at desc);
create unique index if not exists wallet_referral_order_rewards_invitee_active_uidx
  on private.wallet_referral_order_rewards(invitee_user_id)
  where reversed_at is null;

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
     or exists (
       select 1
       from public.wallet_transactions wt
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

  perform pg_advisory_xact_lock(
    hashtextextended('castle-referral-first-purchase:' || v_order.user_id::text,0)
  );

  if exists (
    select 1
    from private.wallet_referral_order_rewards
    where order_id = p_order_id
  ) then
    return 0;
  end if;

  if exists (
    select 1
    from public.orders o
    where o.user_id = v_order.user_id
      and o.id <> p_order_id
      and o.created_at <= v_order.created_at
      and o.status = 'completed'
      and o.central_one_status = 'completed'
      and o.central_one_order_id is not null
  ) then
    return 0;
  end if;

  if exists (
    select 1
    from private.wallet_referral_order_rewards r
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

create or replace function private.reverse_wallet_referral_order_reward(
  p_order_id uuid,
  p_reason text default 'La entrega fue revertida o devuelta'
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reward private.wallet_referral_order_rewards%rowtype;
  v_order_code text;
  v_transaction_id uuid;
begin
  select * into v_reward
  from private.wallet_referral_order_rewards
  where order_id = p_order_id
  for update;

  if not found or v_reward.reversed_at is not null then
    return 0;
  end if;

  select order_code into v_order_code
  from public.orders
  where id = p_order_id;

  insert into public.wallet_transactions(
    user_id,kind,amount,currency,description
  )
  values (
    v_reward.referrer_user_id,
    'purchase',
    v_reward.reward_amount_usd,
    'USD',
    'Reversión de comisión de invitación · pedido ' ||
      coalesce(v_order_code,p_order_id::text) || ' · ' ||
      left(coalesce(p_reason,'Entrega revertida'),180)
  )
  returning id into v_transaction_id;

  update private.wallet_referral_order_rewards
  set reversed_transaction_id = v_transaction_id,
      reversed_at = now()
  where order_id = p_order_id
    and reversed_at is null;

  return v_reward.reward_amount_usd;
end;
$function$;

create or replace function private.handle_wallet_referral_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.central_one_status = 'completed'
     and new.status = 'completed'
     and (old.central_one_status is distinct from 'completed'
          or old.status is distinct from 'completed') then
    perform private.credit_wallet_referral_order_reward(new.id);
  elsif (
       (old.central_one_status = 'completed' or old.status = 'completed')
       and (
         new.central_one_status in ('failed','cancelled','rejected')
         or new.status in ('failed','cancelled','rejected')
       )
  ) then
    perform private.reverse_wallet_referral_order_reward(
      new.id,'La entrega del proveedor fue marcada como fallida, rechazada o cancelada'
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists wallet_referral_order_status_reward on public.orders;
create trigger wallet_referral_order_status_reward
after update of status,central_one_status on public.orders
for each row
execute function private.handle_wallet_referral_order_status();

revoke all on function private.credit_wallet_referral_order_reward(uuid) from public, anon, authenticated;
revoke all on function private.reverse_wallet_referral_order_reward(uuid,text) from public, anon, authenticated;
revoke all on function private.handle_wallet_referral_order_status() from public, anon, authenticated;

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
        'inviter_name',coalesce(nullif(btrim(inviter.full_name),''),'Cliente'),
        'invited_name',coalesce(nullif(btrim(invited.full_name),''),'Cliente'),
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

create or replace function public.get_wallet_referral_admin_summary()
returns jsonb
language sql
set search_path = ''
as $function$
  select private.wallet_referral_admin_summary();
$function$;

-- Referral codes can be linked during the first 7 days, before the first completed purchase.
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

  select created_at into v_created_at
  from auth.users
  where id = v_uid;

  if not found or v_created_at < now() - interval '7 days' then
    raise exception 'El código solo se puede vincular durante los primeros 7 días de una cuenta nueva.';
  end if;

  if exists (
    select 1
    from public.orders
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
    'message','Invitación vinculada. Quien te invitó recibirá el 5 % de tu primera compra cuando la recarga se complete correctamente.'
  );
exception
  when unique_violation then
    raise exception 'Esta cuenta ya tiene una invitación vinculada.';
end;
$function$;

-- 7) Wallet purchases are charged once and can only be created for an active, visible, provider-ready game package.
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

  if length(btrim(coalesce(p_player_id,''))) < 3
     or length(btrim(p_player_id)) > 64 then
    raise exception 'ID de jugador no válido.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));

  select * into v_order
  from public.orders
  where user_id = v_uid
    and wallet_request_id = p_request_id
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

  if not found
     or coalesce(v_product.price_usdt,0) <= 0
     or v_product.provider_product_id is null
     or v_product.provider_region is null
     or coalesce(v_product.provider_validation_supported,false) is distinct from true
     or lower(coalesce(v_product.provider_status,'')) <> 'active'
     or v_product.provider_in_stock is distinct from true
     or coalesce(v_product.provider_requires_target,false) is distinct from true then
    raise exception 'Paquete no disponible para pagar con Coronas o no habilitado para recarga automática.';
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
  set status = 'processing',
      paid_at = now(),
      payment_confirmed_by = v_uid,
      payment_confirmed_at = now()
  where id = v_order.id
    and user_id = v_uid;

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

-- Function privileges: clients may call only the authenticated public entry points.
grant usage on schema private to authenticated;

revoke all on function private.submit_wallet_deposit_proofs(uuid,text[],text,text,text,text) from public, anon;
revoke all on function public.submit_wallet_deposit_proofs(uuid,text[],text,text,text,text) from public, anon;
grant execute on function private.submit_wallet_deposit_proofs(uuid,text[],text,text,text,text) to authenticated, service_role;
grant execute on function public.submit_wallet_deposit_proofs(uuid,text[],text,text,text,text) to authenticated, service_role;

revoke all on function private.create_wallet_order(uuid,text,text,uuid,uuid) from public, anon;
revoke all on function public.create_wallet_order(uuid,text,text,uuid,uuid) from public, anon;
grant execute on function private.create_wallet_order(uuid,text,text,uuid,uuid) to authenticated;
grant execute on function public.create_wallet_order(uuid,text,text,uuid,uuid) to authenticated;

revoke all on function private.apply_wallet_referral_code(text) from public, anon;
revoke all on function public.apply_wallet_referral_code(text) from public, anon;
grant execute on function private.apply_wallet_referral_code(text) to authenticated;
grant execute on function public.apply_wallet_referral_code(text) to authenticated;

revoke all on function private.wallet_referral_summary() from public, anon;
revoke all on function public.get_wallet_referral_summary() from public, anon;
grant execute on function private.wallet_referral_summary() to authenticated;
grant execute on function public.get_wallet_referral_summary() to authenticated;

revoke all on function private.wallet_referral_admin_summary() from public, anon;
revoke all on function public.get_wallet_referral_admin_summary() from public, anon;
grant execute on function private.wallet_referral_admin_summary() to authenticated;
grant execute on function public.get_wallet_referral_admin_summary() to authenticated;

revoke all on function public.admin_review_wallet_deposit(uuid,boolean,text) from public, anon;
grant execute on function public.admin_review_wallet_deposit(uuid,boolean,text) to authenticated;

revoke all on function public.get_wallet_deposit_settings() from public, anon;
grant execute on function public.get_wallet_deposit_settings() to authenticated, service_role;
