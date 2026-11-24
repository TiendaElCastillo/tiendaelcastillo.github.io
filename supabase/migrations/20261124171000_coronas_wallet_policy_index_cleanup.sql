-- Remove an older duplicate wallet-deposit INSERT policy left by the staging baseline.
drop policy if exists wallet_deposits_insert_own_pending on public.wallet_deposits;

-- Keep one active-reward uniqueness index per referred customer.
drop index if exists private.wallet_referral_order_rewards_one_active_per_invitee_uidx;
create unique index if not exists wallet_referral_order_rewards_invitee_active_uidx
  on private.wallet_referral_order_rewards(invitee_user_id)
  where reversed_at is null;
