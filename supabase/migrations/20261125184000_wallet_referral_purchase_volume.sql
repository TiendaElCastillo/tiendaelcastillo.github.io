-- Expose each customer's cumulative completed purchase volume from invited friends.
-- Only live (non-reversed) first-purchase rewards are included.
create or replace function private.wallet_referral_purchase_volume()
returns numeric
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_volume numeric(18,4) := 0;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  select coalesce(sum(r.package_amount_usd),0)::numeric(18,4)
    into v_volume
  from private.wallet_referral_order_rewards r
  where r.referrer_user_id = v_uid
    and r.reversed_at is null;

  return v_volume;
end;
$function$;

revoke all on function private.wallet_referral_purchase_volume() from public, anon, authenticated;

create or replace function public.get_wallet_referral_purchase_volume()
returns jsonb
language sql
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'purchase_volume_usd',
    private.wallet_referral_purchase_volume()
  );
$function$;

revoke all on function public.get_wallet_referral_purchase_volume() from public, anon;
grant execute on function public.get_wallet_referral_purchase_volume() to authenticated;
