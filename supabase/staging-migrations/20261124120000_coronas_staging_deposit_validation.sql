-- Restore the wallet-deposit validation path in the isolated staging project.
-- The only payment instruction seeded here is an explicit TEST-ONLY placeholder.
-- No real receiving account, wallet address or customer balance is touched.

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  instructions text,
  active boolean default true,
  created_at timestamptz default now()
);

alter table public.payment_methods enable row level security;

drop policy if exists payment_methods_read_authenticated on public.payment_methods;
create policy payment_methods_read_authenticated
  on public.payment_methods for select to authenticated
  using (true);

drop policy if exists payment_methods_admin_insert on public.payment_methods;
create policy payment_methods_admin_insert
  on public.payment_methods for insert to authenticated
  with check ((select private.is_admin()));

drop policy if exists payment_methods_admin_update on public.payment_methods;
create policy payment_methods_admin_update
  on public.payment_methods for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

grant select, insert, update on public.payment_methods to authenticated;
revoke all on public.payment_methods from anon, public;

insert into public.payment_methods(name,instructions,active)
values(
  'Transferencia CUP',
  'ENTORNO DE PRUEBAS DE TIENDA EL CASTILLO. NO REALICES NINGÚN PAGO NI ENVÍES DINERO. Este texto solo permite comprobar la interfaz de recarga y no contiene datos de cobro reales.',
  true
)
on conflict(name) do update
set instructions = excluded.instructions,
    active = true;

create or replace function public.validate_wallet_deposit_request()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_settings public.wallet_settings%rowtype;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'No autorizado para crear esta recarga.';
  end if;

  if new.payment_method is distinct from 'Transferencia CUP'
     or new.currency is distinct from 'CUP' then
    raise exception 'La recarga de pruebas solo admite Transferencia CUP.';
  end if;

  if new.amount is null or new.amount <= 0 then
    raise exception 'El importe debe ser mayor que cero.';
  end if;

  select * into v_settings
  from public.wallet_settings
  where id = 1;

  if not found then
    raise exception 'La configuración de Coronas no está disponible.';
  end if;

  if new.amount < v_settings.cup_per_usd then
    raise exception 'La recarga mínima es el equivalente a 1 Corona: % CUP al cambio actual.',
      ceil(v_settings.cup_per_usd);
  end if;

  new.exchange_rate := v_settings.cup_per_usd;
  new.credited_amount := floor((new.amount / v_settings.cup_per_usd) * 100) / 100;

  if new.credited_amount < 1 then
    raise exception 'La recarga debe acreditar al menos 1 Corona.';
  end if;

  if not exists (
    select 1
    from public.payment_methods pm
    where pm.name = 'Transferencia CUP'
      and pm.active is true
      and nullif(trim(pm.instructions),'') is not null
  ) then
    raise exception 'La transferencia CUP no está habilitada en este entorno de pruebas.';
  end if;

  new.network := null;
  new.txid := null;
  new.recipient_address := null;
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

drop trigger if exists validate_wallet_deposit_before_insert on public.wallet_deposits;
create trigger validate_wallet_deposit_before_insert
before insert on public.wallet_deposits
for each row execute function public.validate_wallet_deposit_request();

revoke all on function public.validate_wallet_deposit_request() from public, anon, authenticated;
