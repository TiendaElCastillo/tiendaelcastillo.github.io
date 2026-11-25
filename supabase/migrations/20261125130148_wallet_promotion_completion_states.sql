-- Expose the completion state of the 3% first-deposit bonus and the 5% referral reward
-- to the authenticated customer so the wallet can mark each promotion as obtained.
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
  v_reversed integer := 0;
  v_reward_consumed integer := 0;
  v_earned numeric(18,4) := 0;
  v_invite_linked boolean := false;
  v_applied_code text;
  v_invited_reward_status text;
  v_invited_reward_amount numeric(18,4) := 0;
  v_referral_rows jsonb := '[]'::jsonb;
  v_has_credited_deposit boolean := false;
  v_has_pending_deposit boolean := false;
  v_first_deposit_bonus_amount numeric(18,4) := 0;
  v_first_deposit_status text := 'available';
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  v_code := private.ensure_wallet_referral_code();

  select count(*) into v_referrals
  from private.wallet_referrals
  where referrer_user_id = v_uid;

  select
    count(*) filter (where reversed_at is null),
    count(*) filter (where reversed_at is null),
    count(*) filter (where reversed_at is not null),
    count(*),
    coalesce(sum(reward_amount_usd) filter (where reversed_at is null),0)
  into v_rewarded,v_rewarded_orders,v_reversed,v_reward_consumed,v_earned
  from private.wallet_referral_order_rewards
  where referrer_user_id = v_uid;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'status',case
          when r.order_id is null then 'pending'
          when r.reversed_at is not null then 'reversed'
          else 'obtained'
        end,
        'reward_amount_usd',coalesce(r.reward_amount_usd,0),
        'linked_at',wr.linked_at,
        'rewarded_at',r.rewarded_at
      )
      order by wr.linked_at desc
    ),
    '[]'::jsonb
  )
  into v_referral_rows
  from private.wallet_referrals wr
  left join private.wallet_referral_order_rewards r
    on r.invitee_user_id = wr.invitee_user_id
  where wr.referrer_user_id = v_uid;

  select
    true,
    wr.referral_code,
    case
      when r.order_id is null then 'pending'
      when r.reversed_at is not null then 'reversed'
      else 'obtained'
    end,
    coalesce(r.reward_amount_usd,0)
  into v_invite_linked,v_applied_code,v_invited_reward_status,v_invited_reward_amount
  from private.wallet_referrals wr
  left join private.wallet_referral_order_rewards r
    on r.invitee_user_id = wr.invitee_user_id
  where wr.invitee_user_id = v_uid
  limit 1;

  select exists (
    select 1
    from public.wallet_transactions
    where user_id = v_uid
      and kind = 'deposit'
      and currency = 'USD'
  ) into v_has_credited_deposit;

  select exists (
    select 1
    from public.wallet_deposits
    where user_id = v_uid
      and status in ('pending','payment_review')
  ) into v_has_pending_deposit;

  select coalesce(sum(welcome_bonus_amount),0)
  into v_first_deposit_bonus_amount
  from public.wallet_deposits
  where user_id = v_uid
    and status = 'approved';

  if v_first_deposit_bonus_amount > 0 then
    v_first_deposit_status := 'obtained';
  elsif v_has_credited_deposit then
    v_first_deposit_status := 'used';
  elsif v_has_pending_deposit then
    v_first_deposit_status := 'pending';
  else
    v_first_deposit_status := 'available';
  end if;

  return jsonb_build_object(
    'code',v_code,
    'referrals_count',v_referrals,
    'rewarded_count',v_rewarded,
    'referral_orders_count',v_rewarded_orders,
    'earned_usd',v_earned,
    'referral_percent',5,
    'reward_basis','first_successfully_completed_purchase',
    'invite_linked',coalesce(v_invite_linked,false),
    'applied_referral_code',v_applied_code,
    'referrals',v_referral_rows,
    'referral_rewards_consumed_count',v_reward_consumed,
    'reversed_count',v_reversed,
    'invited_reward_status',v_invited_reward_status,
    'invited_reward_amount_usd',v_invited_reward_amount,
    'first_deposit_status',v_first_deposit_status,
    'first_deposit_bonus_amount',v_first_deposit_bonus_amount
  );
end;
$function$;
