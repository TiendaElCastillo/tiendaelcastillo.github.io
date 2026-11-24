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
  where id=1;
  if not found then
    raise exception 'La configuración de Coronas no está disponible.';
  end if;

  v_rate := v_settings.cup_per_usd;

  if pg_catalog.to_regclass('public.pricing_settings') is not null then
    execute 'select usdt_cup_rate,mobile_credit_units,mobile_cost_cup
             from public.pricing_settings where id=1'
      into v_rate,v_mobile_units,v_mobile_cost;
  else
    execute 'select mobile_credit_units,mobile_cost_cup
             from public.wallet_settings where id=1'
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
