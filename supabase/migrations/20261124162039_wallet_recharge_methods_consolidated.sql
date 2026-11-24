alter table public.wallet_settings
  add column if not exists mobile_credit_units integer not null default 360,
  add column if not exists mobile_cost_cup numeric(14,2) not null default 1200;

alter table public.wallet_deposits
  drop constraint if exists wallet_deposits_currency_check;
alter table public.wallet_deposits
  add constraint wallet_deposits_currency_check
  check (currency = any (array['CUP'::text,'USDT'::text,'MOBILE'::text]));

CREATE OR REPLACE FUNCTION public.validate_wallet_deposit_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_settings public.wallet_settings%rowtype;
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

  if new.amount is null or new.amount <= 0 then
    raise exception 'El importe debe ser mayor que cero.';
  end if;

  if new.payment_method = 'Transferencia CUP' and new.currency = 'CUP' then
    if new.amount <> trunc(new.amount) then
      raise exception 'La transferencia CUP debe indicarse en pesos enteros.';
    end if;
    if new.amount < v_settings.cup_per_usd then
      raise exception 'La recarga mínima es 1 Corona: % CUP al cambio actual.', ceil(v_settings.cup_per_usd);
    end if;
    new.exchange_rate := v_settings.cup_per_usd;
    new.credited_amount := floor((new.amount / v_settings.cup_per_usd) * 100) / 100;
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
    new.credited_amount := floor(new.amount * 100) / 100;
    new.network := 'BNB Smart Chain (BEP20)';
    new.recipient_address := v_settings.usdt_address;

  elsif new.payment_method = 'Saldo móvil' and new.currency = 'MOBILE' then
    if new.amount <> trunc(new.amount) then
      raise exception 'El saldo móvil debe indicarse en unidades enteras.';
    end if;
    if v_settings.mobile_credit_units is null or v_settings.mobile_credit_units <= 0
       or v_settings.mobile_cost_cup is null or v_settings.mobile_cost_cup <= 0
       or v_settings.cup_per_usd <= 0 then
      raise exception 'La conversión de saldo móvil no está configurada.';
    end if;
    v_units_per_corona := (v_settings.mobile_credit_units * v_settings.cup_per_usd) / v_settings.mobile_cost_cup;
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
    select 1 from public.payment_methods pm
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
$function$
;

CREATE OR REPLACE FUNCTION private.submit_wallet_deposit_proofs(p_deposit_id uuid, p_proof_paths text[], p_reference text DEFAULT NULL::text, p_sender_phone text DEFAULT NULL::text, p_txid text DEFAULT NULL::text, p_network text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if v_uid is null then raise exception 'Debes iniciar sesión.'; end if;
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
  if not found then raise exception 'No encontramos la recarga en tu cuenta.'; end if;
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

  if v_deposit.payment_method in ('Transferencia CUP','Saldo móvil') then
    if v_deposit.payment_method = 'Transferencia CUP'
       and (v_reference is null or length(v_reference) < 3 or length(v_reference) > 100) then
      raise exception 'Escribe la referencia de la transferencia bancaria.';
    end if;
    if v_phone is null or v_phone !~ '^[+]?[0-9 ().-]{8,20}$'
       or length(regexp_replace(v_phone,'[^0-9]','','g')) not between 8 and 15 then
      raise exception 'Escribe el teléfono desde el que enviaste el pago.';
    end if;

    if v_reference is not null then
      if length(v_reference) < 3 or length(v_reference) > 100 then
        raise exception 'La referencia debe tener entre 3 y 100 caracteres.';
      end if;
      v_reference_scope := case when v_deposit.payment_method = 'Transferencia CUP' then 'CUP' else 'MOBILE' end;
      perform pg_advisory_xact_lock(hashtextextended('castle-payment-reference:' || v_reference_scope || ':' || v_reference,0));

      if v_deposit.payment_reference is not null
         and upper(regexp_replace(v_deposit.payment_reference,'[[:space:]]+','','g')) <> v_reference then
        raise exception 'La referencia ya quedó registrada en esta solicitud.';
      end if;

      if exists (
        select 1 from public.wallet_deposits d
        where d.id <> p_deposit_id
          and d.payment_method = v_deposit.payment_method
          and upper(regexp_replace(coalesce(d.payment_reference,''),'[[:space:]]+','','g')) = v_reference
      ) then
        raise exception 'Esa referencia ya fue utilizada en otra solicitud de recarga.';
      end if;

      if exists (
        select 1 from public.orders o
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

    perform pg_advisory_xact_lock(hashtextextended('castle-payment-reference:USDT:' || v_txid,0));
    if v_deposit.txid is not null and lower(v_deposit.txid) <> v_txid then
      raise exception 'El TxID ya quedó registrado en esta solicitud.';
    end if;
    if exists (
      select 1 from public.wallet_deposits d
      where d.id <> p_deposit_id and lower(coalesce(d.txid,'')) = v_txid
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
      payment_reference = case when v_deposit.payment_method in ('Transferencia CUP','Saldo móvil') then v_reference else v_txid end,
      sender_phone = case when v_deposit.payment_method in ('Transferencia CUP','Saldo móvil') then v_phone else null end,
      txid = case when v_deposit.payment_method = 'USDT' then v_txid else null end,
      network = case when v_deposit.payment_method = 'USDT' then 'BNB Smart Chain (BEP20)' else null end,
      status = 'payment_review'
  where id = p_deposit_id and user_id = v_uid;

  return jsonb_build_object('deposit_id',p_deposit_id,'status','payment_review','proofs_received',v_count);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_review_wallet_deposit(p_deposit_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_deposit public.wallet_deposits%rowtype;
  v_note text := nullif(trim(coalesce(p_note,'')),'');
  v_has_previous_deposit boolean := false;
  v_welcome_bonus numeric(14,4) := 0;
begin
  if not private.is_admin() then raise exception 'No autorizado.'; end if;
  if p_approve is null then raise exception 'Selecciona aprobar o rechazar.'; end if;

  select * into v_deposit
  from public.wallet_deposits
  where id = p_deposit_id
  for update;
  if not found then raise exception 'Depósito no encontrado.'; end if;
  if v_deposit.status <> 'payment_review' then
    raise exception 'El depósito debe estar en revisión y no puede acreditarse dos veces.';
  end if;
  if not exists (select 1 from public.wallet_deposit_proofs p where p.deposit_id = p_deposit_id) then
    raise exception 'No hay comprobantes asociados a este depósito.';
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
       and (v_deposit.txid is null
            or v_deposit.network <> 'BNB Smart Chain (BEP20)'
            or coalesce(v_deposit.recipient_address,'') !~* '^0x[a-f0-9]{40}$') then
      raise exception 'La información de red, dirección o TxID no es válida.';
    end if;

    perform pg_advisory_xact_lock(hashtextextended('castle-wallet-first-deposit:' || v_deposit.user_id::text,0));
    select exists(
      select 1 from public.wallet_transactions
      where user_id = v_deposit.user_id and kind = 'deposit' and currency = 'USD'
    ) into v_has_previous_deposit;

    if not v_has_previous_deposit then
      v_welcome_bonus := round(v_deposit.credited_amount * 0.03,4);
    end if;

    insert into public.wallet_transactions(user_id,deposit_id,kind,amount,currency,description)
    values(
      v_deposit.user_id,p_deposit_id,'deposit',
      v_deposit.credited_amount + v_welcome_bonus,'USD',
      case
        when v_welcome_bonus > 0 then
          case
            when v_deposit.payment_method = 'Transferencia CUP' then 'Primera recarga CUP aprobada + bono del 3 % sin límite'
            when v_deposit.payment_method = 'Saldo móvil' then 'Primera recarga de saldo móvil aprobada + bono del 3 % sin límite'
            else 'Primera recarga USDT BEP20 aprobada + bono del 3 % sin límite'
          end
        else
          case
            when v_deposit.payment_method = 'Transferencia CUP' then 'Depósito por transferencia CUP aprobado'
            when v_deposit.payment_method = 'Saldo móvil' then 'Recarga de saldo móvil aprobada'
            else 'Depósito USDT BEP20 aprobado'
          end
      end
    );

    update public.wallet_deposits
    set status='approved',
        welcome_bonus_amount=v_welcome_bonus,
        admin_notes=nullif(v_note,''),
        reviewed_at=now(),
        reviewed_by=auth.uid()
    where id=p_deposit_id;
  else
    if v_note is null or length(v_note)<5 then
      raise exception 'Es obligatorio explicar el motivo del rechazo (mínimo 5 caracteres).';
    end if;
    update public.wallet_deposits
    set status='rejected',admin_notes=v_note,reviewed_at=now(),reviewed_by=auth.uid()
    where id=p_deposit_id;
  end if;

  return jsonb_build_object(
    'deposit_id',p_deposit_id,
    'status',case when p_approve then 'approved' else 'rejected' end,
    'credited_amount',case when p_approve then v_deposit.credited_amount else 0 end,
    'welcome_bonus_amount',case when p_approve then v_welcome_bonus else 0 end
  );
end;
$function$
;

revoke all on function private.submit_wallet_deposit_proofs(uuid,text[],text,text,text,text) from public, anon;
grant execute on function private.submit_wallet_deposit_proofs(uuid,text[],text,text,text,text) to authenticated, service_role;