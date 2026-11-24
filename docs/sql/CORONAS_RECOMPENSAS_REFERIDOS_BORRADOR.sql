-- BORRADOR PARA REVISIÓN — NO EJECUTAR DIRECTAMENTE EN PRODUCCIÓN.
-- Crear el archivo final con `supabase migration new ...` y revisar contra el esquema real.
-- Reglas confirmadas:
--   * 1 Corona = 1 USD.
--   * Primera recarga de wallet aprobada: 3 % del importe completo, sin límite.
--   * Invitador: 5 % del valor USD de cada paquete de su amigo solo cuando se confirme completed.
--   * Una sola comisión por pedido; revertirla si la entrega se revierte o se devuelve.
--   * El libro de cartera conserva USD para no alterar registros históricos.

-- ---------------------------------------------------------------------------
-- 1. Tabla privada de comisiones por pedido entregado
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private.wallet_referral_order_rewards (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  invitee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  package_amount_usd numeric(18,4) NOT NULL CHECK (package_amount_usd > 0),
  reward_amount_usd numeric(18,4) NOT NULL CHECK (reward_amount_usd > 0),
  wallet_transaction_id uuid NOT NULL UNIQUE REFERENCES public.wallet_transactions(id) ON DELETE RESTRICT,
  rewarded_at timestamptz NOT NULL DEFAULT now(),
  reversed_transaction_id uuid UNIQUE REFERENCES public.wallet_transactions(id) ON DELETE RESTRICT,
  reversed_at timestamptz,
  CHECK ((reversed_at IS NULL AND reversed_transaction_id IS NULL)
      OR (reversed_at IS NOT NULL AND reversed_transaction_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS wallet_referral_order_rewards_referrer_idx
  ON private.wallet_referral_order_rewards(referrer_user_id, rewarded_at DESC);

ALTER TABLE private.wallet_referral_order_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.wallet_referral_order_rewards FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Acreditar 5 % solo tras entrega confirmada por el proveedor
--    wallet_refund_amount es la instantánea USD del paquete tomada al crear
--    el pedido; no se usa el importe CUP ni el valor vigente de catálogo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.credit_wallet_referral_order_reward(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_order public.orders%rowtype;
  v_referrer uuid;
  v_reward numeric(18,4);
  v_transaction_id uuid;
BEGIN
  SELECT * INTO v_order
   FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_order.status IS DISTINCT FROM 'completed'
     OR v_order.central_one_status IS DISTINCT FROM 'completed'
     OR v_order.central_one_order_id IS NULL
     OR v_order.payment_confirmed_at IS NULL
     OR coalesce(v_order.wallet_refund_amount,0) <= 0 THEN
    RETURN 0;
  END IF;

  SELECT referrer_user_id INTO v_referrer
  FROM private.wallet_referrals
  WHERE invitee_user_id = v_order.user_id;

  IF NOT FOUND OR v_referrer IS NULL OR v_referrer = v_order.user_id THEN
    RETURN 0;
  END IF;

  -- The order_id primary key and transaction insert run in the same
  -- transaction, so a repeated provider update cannot pay twice.
  IF EXISTS (
    SELECT 1
    FROM private.wallet_referral_order_rewards
    WHERE order_id = p_order_id
  ) THEN
    RETURN 0;
  END IF;

  v_reward := round(v_order.wallet_refund_amount * 0.05,4);
  IF v_reward <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.wallet_transactions(
    user_id,order_id,kind,amount,currency,description
  )
  VALUES (
    v_referrer,p_order_id,'adjustment',v_reward,'USD',
    'Comisión de invitación del 5 % por paquete entregado · pedido ' || v_order.order_code
  )
  RETURNING id INTO v_transaction_id;

  INSERT INTO private.wallet_referral_order_rewards(
    order_id,referrer_user_id,invitee_user_id,package_amount_usd,
    reward_amount_usd,wallet_transaction_id
  )
  VALUES (
    p_order_id,v_referrer,v_order.user_id,v_order.wallet_refund_amount,
    v_reward,v_transaction_id
  );

  RETURN v_reward;
END;
$function$;

REVOKE ALL ON FUNCTION private.credit_wallet_referral_order_reward(uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Revertir la comisión una sola vez si se devuelve o revierte la entrega.
--    'purchase' resta saldo según private.wallet_balance; order_id queda NULL
--    para no colisionar con la compra original del cliente referido.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.reverse_wallet_referral_order_reward(
  p_order_id uuid,
  p_reason text DEFAULT 'La entrega fue revertida o devuelta'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_reward private.wallet_referral_order_rewards%rowtype;
  v_order_code text;
  v_transaction_id uuid;
BEGIN
  SELECT * INTO v_reward
  FROM private.wallet_referral_order_rewards
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_reward.reversed_at IS NOT NULL THEN
    RETURN 0;
  END IF;

  SELECT order_code INTO v_order_code
  FROM public.orders
  WHERE id = p_order_id;

  INSERT INTO public.wallet_transactions(
    user_id,kind,amount,currency,description
  )
  VALUES (
    v_reward.referrer_user_id,'purchase',v_reward.reward_amount_usd,'USD',
    'Reversión de comisión de invitación · pedido ' ||
      coalesce(v_order_code,p_order_id::text) || ' · ' ||
      left(coalesce(p_reason,'Entrega revertida'),180)
  )
  RETURNING id INTO v_transaction_id;

  UPDATE private.wallet_referral_order_rewards
  SET reversed_transaction_id = v_transaction_id,
      reversed_at = now()
  WHERE order_id = p_order_id
    AND reversed_at IS NULL;

  RETURN v_reward.reward_amount_usd;
END;
$function$;

REVOKE ALL ON FUNCTION private.reverse_wallet_referral_order_reward(uuid,text)
  FROM PUBLIC, anon, authenticated;

-- Provider result transitions are written by the restricted
-- finish_central_one_order function. Reward creation happens only when both
-- provider and local order statuses are completed.
CREATE OR REPLACE FUNCTION private.handle_wallet_referral_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.central_one_status = 'completed'
     AND NEW.status = 'completed'
     AND (OLD.central_one_status IS DISTINCT FROM 'completed'
          OR OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM private.credit_wallet_referral_order_reward(NEW.id);
  ELSIF (
       (OLD.central_one_status = 'completed' OR OLD.status = 'completed')
       AND (NEW.central_one_status IN ('failed','cancelled')
            OR NEW.status IN ('failed','cancelled'))
  ) THEN
    PERFORM private.reverse_wallet_referral_order_reward(
      NEW.id,'Central One marcó la entrega como fallida o cancelada'
    );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.handle_wallet_referral_order_status()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS wallet_referral_order_status_reward
  ON public.orders;
CREATE TRIGGER wallet_referral_order_status_reward
AFTER UPDATE OF status, central_one_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION private.handle_wallet_referral_order_status();

-- If the existing safe-refund workflow credits the referred customer's wallet
-- after a completed delivery, reverse the inviter commission too.
CREATE OR REPLACE FUNCTION private.handle_wallet_referral_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.kind = 'refund' AND NEW.order_id IS NOT NULL AND NEW.currency = 'USD' THEN
    PERFORM private.reverse_wallet_referral_order_reward(
      NEW.order_id,'Se acreditó la devolución del pedido al cliente'
    );
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.handle_wallet_referral_refund()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS wallet_referral_order_refund
  ON public.wallet_transactions;
CREATE TRIGGER wallet_referral_order_refund
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW
WHEN (NEW.kind = 'refund' AND NEW.order_id IS NOT NULL AND NEW.currency = 'USD')
EXECUTE FUNCTION private.handle_wallet_referral_refund();

-- ---------------------------------------------------------------------------
-- 4. Public summary is limited to the signed-in account's referral activity.
-- ---------------------------------------------------------------------------
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
  v_rewarded_friends integer := 0;
  v_rewarded_orders integer := 0;
  v_earned numeric(14,4) := 0;
  v_invite_linked boolean := false;
  v_applied_code text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.';
  END IF;

  v_code := private.ensure_wallet_referral_code();

  SELECT count(*) INTO v_referrals
  FROM private.wallet_referrals
  WHERE referrer_user_id = v_uid;

  SELECT count(DISTINCT invitee_user_id),
         count(*),
         coalesce(sum(reward_amount_usd),0)
  INTO v_rewarded_friends,v_rewarded_orders,v_earned
  FROM private.wallet_referral_order_rewards
  WHERE referrer_user_id = v_uid
    AND reversed_at IS NULL;

  SELECT true,referral_code
  INTO v_invite_linked,v_applied_code
  FROM private.wallet_referrals
  WHERE invitee_user_id = v_uid
  LIMIT 1;

  RETURN jsonb_build_object(
    'code',v_code,
    'referrals_count',v_referrals,
    'rewarded_count',v_rewarded_friends,
    'referral_orders_count',v_rewarded_orders,
    'earned_usd',v_earned,
    'referral_percent',5,
    'reward_basis','each_completed_package',
    'invite_linked',coalesce(v_invite_linked,false),
    'applied_referral_code',v_applied_code
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Deposit approval: 3 % of the full first approved recharge, no cap.
--    Keep the existing payment/proof checks and manual admin approval.
-- ---------------------------------------------------------------------------
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
      v_welcome_bonus := round(v_deposit.credited_amount * 0.03,4);
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
          CASE WHEN v_deposit.currency = 'CUP' THEN 'Primera recarga CUP aprobada + bono de bienvenida del 3 % sin límite'
               ELSE 'Primera recarga USDT BEP20 aprobada + bono de bienvenida del 3 % sin límite' END
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
    'welcome_bonus_amount',CASE WHEN p_approve THEN v_welcome_bonus ELSE 0 END
  );
END;
$function$;

-- The former 0.7 % first-deposit commission is retired. Keep legacy history
-- columns and rows intact, but prevent any future direct call of the old helper.
REVOKE ALL ON FUNCTION private.reward_wallet_referrer(uuid,uuid,numeric)
  FROM PUBLIC, anon, authenticated;
