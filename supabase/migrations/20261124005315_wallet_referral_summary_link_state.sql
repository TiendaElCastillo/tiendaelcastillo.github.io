CREATE OR REPLACE FUNCTION private.wallet_referral_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_referrals integer := 0;
  v_rewarded integer := 0;
  v_earned numeric(14,4) := 0;
  v_invite_linked boolean := false;
  v_applied_code text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  v_code := private.ensure_wallet_referral_code();

  SELECT count(*),
         count(*) FILTER (WHERE rewarded_at IS NOT NULL),
         coalesce(sum(reward_amount),0)
  INTO v_referrals,v_rewarded,v_earned
  FROM private.wallet_referrals
  WHERE referrer_user_id = v_uid;

  SELECT true,referral_code
  INTO v_invite_linked,v_applied_code
  FROM private.wallet_referrals
  WHERE invitee_user_id = v_uid
  LIMIT 1;

  RETURN jsonb_build_object(
    'code',v_code,
    'referrals_count',v_referrals,
    'rewarded_count',v_rewarded,
    'earned_usd',v_earned,
    'referral_percent',0.7,
    'referral_cap_usd',10,
    'referral_max_reward_usd',0.07,
    'invite_linked',coalesce(v_invite_linked,false),
    'applied_referral_code',v_applied_code
  );
END;
$function$;
