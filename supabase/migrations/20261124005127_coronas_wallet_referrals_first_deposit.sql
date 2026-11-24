-- Coronas del Castillo: preserve USD as the internal ledger unit, while enabling
-- accurate coin presentation and first-deposit/referral rewards.
ALTER TABLE public.wallet_transactions
  ALTER COLUMN amount TYPE numeric(18,4);

ALTER TABLE public.wallet_deposits
  ADD COLUMN IF NOT EXISTS welcome_bonus_amount numeric(14,4) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS private.wallet_referral_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_referral_codes_code_format CHECK (code ~ '^[A-F0-9]{8}$')
);
ALTER TABLE private.wallet_referral_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.wallet_referral_codes FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.wallet_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  invitee_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  referral_code text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  rewarded_deposit_id uuid REFERENCES public.wallet_deposits(id) ON DELETE RESTRICT,
  reward_amount numeric(14,4) NOT NULL DEFAULT 0,
  rewarded_at timestamptz,
  CONSTRAINT wallet_referrals_not_self CHECK (referrer_user_id <> invitee_user_id),
  CONSTRAINT wallet_referrals_reward_consistency CHECK (
    (rewarded_at IS NULL AND rewarded_deposit_id IS NULL AND reward_amount = 0)
    OR (rewarded_at IS NOT NULL AND rewarded_deposit_id IS NOT NULL AND reward_amount > 0)
  )
);
CREATE INDEX IF NOT EXISTS wallet_referrals_referrer_user_id_idx
  ON private.wallet_referrals(referrer_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_referrals_rewarded_deposit_unique
  ON private.wallet_referrals(rewarded_deposit_id)
  WHERE rewarded_deposit_id IS NOT NULL;
ALTER TABLE private.wallet_referrals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.wallet_referrals FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.ensure_wallet_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_attempt integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  SELECT code INTO v_code
  FROM private.wallet_referral_codes
  WHERE user_id = v_uid;
  IF FOUND THEN
    RETURN v_code;
  END IF;

  FOR v_attempt IN 1..10 LOOP
    v_code := upper(substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8));
    BEGIN
      INSERT INTO private.wallet_referral_codes(user_id,code)
      VALUES(v_uid,v_code)
      ON CONFLICT(user_id) DO NOTHING
      RETURNING code INTO v_code;
      IF FOUND THEN
        RETURN v_code;
      END IF;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;

    SELECT code INTO v_code
    FROM private.wallet_referral_codes
    WHERE user_id = v_uid;
    IF FOUND THEN
      RETURN v_code;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'No pudimos generar tu código de invitación. Vuelve a intentarlo.';
END;
$function$;

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

  RETURN jsonb_build_object(
    'code',v_code,
    'referrals_count',v_referrals,
    'rewarded_count',v_rewarded,
    'earned_usd',v_earned,
    'referral_percent',0.7,
    'referral_cap_usd',10,
    'referral_max_reward_usd',0.07
  );
END;
$function$;

CREATE OR REPLACE FUNCTION private.apply_wallet_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_referrer uuid;
  v_created_at timestamptz;
  v_code text := upper(trim(coalesce(p_code,'')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para usar una invitación.';
  END IF;
  IF v_code !~ '^[A-F0-9]{8}$' THEN
    RAISE EXCEPTION 'El código de invitación no tiene un formato válido.';
  END IF;

  SELECT user_id INTO v_referrer
  FROM private.wallet_referral_codes
  WHERE code = v_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ese código de invitación no existe.';
  END IF;
  IF v_referrer = v_uid THEN
    RAISE EXCEPTION 'No puedes usar tu propio código de invitación.';
  END IF;

  SELECT created_at INTO v_created_at
  FROM auth.users
  WHERE id = v_uid;
  IF NOT FOUND OR v_created_at < now() - interval '7 days' THEN
    RAISE EXCEPTION 'El código solo se puede vincular durante los primeros 7 días de una cuenta nueva.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.wallet_deposits WHERE user_id = v_uid
  ) OR EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE user_id = v_uid AND kind = 'deposit' AND currency = 'USD'
  ) THEN
    RAISE EXCEPTION 'La invitación debe vincularse antes de solicitar la primera recarga de saldo.';
  END IF;

  INSERT INTO private.wallet_referrals(referrer_user_id,invitee_user_id,referral_code)
  VALUES(v_referrer,v_uid,v_code);

  RETURN jsonb_build_object(
    'linked',true,
    'message','Invitación vinculada. Tu amigo recibirá el bono de primera recarga si corresponde.'
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Esta cuenta ya tiene una invitación vinculada.';
END;
$function$;

CREATE OR REPLACE FUNCTION private.reward_wallet_referrer(
  p_invitee_user_id uuid,
  p_deposit_id uuid,
  p_deposit_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_referral private.wallet_referrals%rowtype;
  v_reward numeric(14,4);
  v_deposit_count integer;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'No autorizado para acreditar recompensas de invitación.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.wallet_deposits
    WHERE id = p_deposit_id
      AND user_id = p_invitee_user_id
      AND status = 'approved'
      AND abs(credited_amount - p_deposit_amount) < 0.000001
  ) THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO v_deposit_count
  FROM public.wallet_transactions
  WHERE user_id = p_invitee_user_id
    AND kind = 'deposit'
    AND currency = 'USD';

  IF v_deposit_count <> 1 THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_referral
  FROM private.wallet_referrals
  WHERE invitee_user_id = p_invitee_user_id
    AND rewarded_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Four decimal places keep 0.7% accurate for small deposits:
  -- 0.007 USD = 0.70 COR when 100 COR = 1 USD.
  v_reward := round(least(greatest(coalesce(p_deposit_amount,0),0),10) * 0.007,4);
  IF v_reward <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.wallet_transactions(user_id,kind,amount,currency,description)
  VALUES(
    v_referral.referrer_user_id,
    'adjustment',
    v_reward,
    'USD',
    'Recompensa por invitación: 0,7 % de la primera recarga aprobada (base máxima 10 USD).'
  );

  UPDATE private.wallet_referrals
  SET rewarded_deposit_id = p_deposit_id,
      reward_amount = v_reward,
      rewarded_at = now()
  WHERE id = v_referral.id
    AND rewarded_at IS NULL;

  RETURN v_reward;
END;
$function$;

REVOKE ALL ON FUNCTION private.ensure_wallet_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.wallet_referral_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.apply_wallet_referral_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.reward_wallet_referrer(uuid,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.wallet_referral_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION private.apply_wallet_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.reward_wallet_referrer(uuid,uuid,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_wallet_referral_summary()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.wallet_referral_summary();
$function$;

CREATE OR REPLACE FUNCTION public.apply_wallet_referral_code(p_code text)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT private.apply_wallet_referral_code(p_code);
$function$;

REVOKE ALL ON FUNCTION public.get_wallet_referral_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_wallet_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wallet_referral_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_wallet_referral_code(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_wallet_deposit(
  p_deposit_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_deposit public.wallet_deposits%rowtype;
  v_note text := nullif(trim(coalesce(p_note,'')),'');
  v_has_previous_deposit boolean := false;
  v_welcome_bonus numeric(14,4) := 0;
  v_referral_bonus numeric(14,4) := 0;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;
  IF p_approve IS NULL THEN
    RAISE EXCEPTION 'Selecciona aprobar o rechazar.';
  END IF;

  SELECT * INTO v_deposit
  FROM public.wallet_deposits
  WHERE id = p_deposit_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Depósito no encontrado.';
  END IF;
  IF v_deposit.status <> 'payment_review' THEN
    RAISE EXCEPTION 'El depósito debe estar en revisión y no puede acreditarse dos veces.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.wallet_deposit_proofs p WHERE p.deposit_id = p_deposit_id
  ) THEN
    RAISE EXCEPTION 'No hay comprobantes asociados a este depósito.';
  END IF;

  IF p_approve THEN
    IF coalesce(v_deposit.credited_amount,0) < 1 THEN
      RAISE EXCEPTION 'El importe a acreditar no cumple el mínimo de 1 USD.';
    END IF;
    IF v_deposit.payment_method = 'Transferencia CUP'
       AND (v_deposit.payment_reference IS NULL OR v_deposit.sender_phone IS NULL) THEN
      RAISE EXCEPTION 'Faltan los datos de verificación de la transferencia CUP.';
    END IF;
    IF v_deposit.payment_method = 'USDT'
       AND (v_deposit.txid IS NULL OR v_deposit.network <> 'BNB Smart Chain (BEP20)' OR v_deposit.recipient_address IS NULL) THEN
      RAISE EXCEPTION 'La información de red, dirección o TxID no es válida.';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('castle-wallet-first-deposit:' || v_deposit.user_id::text,0));
    SELECT EXISTS(
      SELECT 1 FROM public.wallet_transactions
      WHERE user_id = v_deposit.user_id AND kind = 'deposit' AND currency = 'USD'
    ) INTO v_has_previous_deposit;

    IF NOT v_has_previous_deposit THEN
      v_welcome_bonus := round(least(v_deposit.credited_amount,10) * 0.03,4);
    END IF;

    INSERT INTO public.wallet_transactions(user_id,deposit_id,kind,amount,currency,description)
    VALUES(
      v_deposit.user_id,
      p_deposit_id,
      'deposit',
      v_deposit.credited_amount + v_welcome_bonus,
      'USD',
      CASE
        WHEN v_welcome_bonus > 0 THEN
          CASE WHEN v_deposit.currency = 'CUP' THEN 'Depósito CUP aprobado + bono de bienvenida del 3 % (máximo 10 USD de base)'
               ELSE 'Depósito USDT BEP20 aprobado + bono de bienvenida del 3 % (máximo 10 USD de base)' END
        ELSE
          CASE WHEN v_deposit.currency = 'CUP' THEN 'Depósito por transferencia CUP aprobado'
               ELSE 'Depósito USDT BEP20 aprobado' END
      END
    );

    UPDATE public.wallet_deposits
    SET status = 'approved',
        welcome_bonus_amount = v_welcome_bonus,
        admin_notes = nullif(v_note,''),
        reviewed_at = now(),
        reviewed_by = auth.uid()
    WHERE id = p_deposit_id;

    v_referral_bonus := private.reward_wallet_referrer(
      v_deposit.user_id,
      p_deposit_id,
      v_deposit.credited_amount
    );
  ELSE
    IF v_note IS NULL OR length(v_note) < 5 THEN
      RAISE EXCEPTION 'Es obligatorio explicar el motivo del rechazo (mínimo 5 caracteres).';
    END IF;
    UPDATE public.wallet_deposits
    SET status = 'rejected',
        admin_notes = v_note,
        reviewed_at = now(),
        reviewed_by = auth.uid()
    WHERE id = p_deposit_id;
  END IF;

  RETURN jsonb_build_object(
    'deposit_id',p_deposit_id,
    'status',CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    'credited_amount',CASE WHEN p_approve THEN v_deposit.credited_amount ELSE 0 END,
    'welcome_bonus_amount',CASE WHEN p_approve THEN v_welcome_bonus ELSE 0 END,
    'referral_bonus_amount',CASE WHEN p_approve THEN v_referral_bonus ELSE 0 END
  );
END;
$function$;
