-- Restore the player-ID validation receipt and per-user rate limit in staging.

-- This matches the production validation contract; no provider calls or secrets are added here.

CREATE TABLE IF NOT EXISTS public.player_id_validations (
   token uuid PRIMARY KEY,
   user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
   product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
   provider_product_id text NOT NULL,
   region text NOT NULL,
   player_id_hash text NOT NULL,
   player_name text,
   validated_at timestamptz NOT NULL DEFAULT now(),
   expires_at timestamptz NOT NULL,
   consumed_at timestamptz,
   created_at timestamptz NOT NULL DEFAULT now(),
   CONSTRAINT player_id_validations_expiry_check CHECK (expires_at > validated_at)
 );

CREATE INDEX IF NOT EXISTS player_id_validations_product_id_idx ON public.player_id_validations(product_id);

CREATE INDEX IF NOT EXISTS player_id_validations_user_id_idx ON public.player_id_validations(user_id);

ALTER TABLE public.player_id_validations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.player_id_validations FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.player_id_validations TO service_role;

CREATE TABLE IF NOT EXISTS private.player_validation_rate_limits (
   user_id uuid PRIMARY KEY,
   window_started_at timestamptz NOT NULL,
   request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0 AND request_count <= 8),
   updated_at timestamptz NOT NULL DEFAULT now()
 );

ALTER TABLE private.player_validation_rate_limits ENABLE ROW LEVEL SECURITY;

ALTER TABLE private.player_validation_rate_limits FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.player_validation_rate_limits FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.consume_player_validation_rate_limit(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_started timestamptz;
  v_count integer;
begin
  if p_user_id is null then
    raise exception 'user_required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 92117)
  );

  select r.window_started_at, r.request_count
    into v_started, v_count
  from private.player_validation_rate_limits r
  where r.user_id = p_user_id
  for update;

  if not found or v_now >= v_started + interval '1 minute' then
    insert into private.player_validation_rate_limits(user_id, window_started_at, request_count, updated_at)
    values (p_user_id, v_now, 1, v_now)
    on conflict (user_id) do update
      set window_started_at = excluded.window_started_at,
          request_count = 1,
          updated_at = excluded.updated_at;
    return true;
  end if;

  if v_count >= 8 then
    return false;
  end if;

  update private.player_validation_rate_limits
  set request_count = request_count + 1,
      updated_at = v_now
  where user_id = p_user_id;

  return true;
end;
$function$;

REVOKE ALL ON FUNCTION private.consume_player_validation_rate_limit(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_player_validation_rate_limit(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return private.consume_player_validation_rate_limit(p_user_id);
end;
$function$;

REVOKE ALL ON FUNCTION public.consume_player_validation_rate_limit(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_player_validation_rate_limit(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.enforce_provider_player_validation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_product public.products%rowtype;
  v_validation public.player_id_validations%rowtype;
  v_hash text;
BEGIN
  SELECT * INTO v_product
  FROM public.products
  WHERE id = NEW.product_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto no existe.';
  END IF;

  -- Free Fire must never use the legacy no-provider path: every FF order
  -- requires a supported Central One product and a single-use validation token.
  IF lower(btrim(coalesce(v_product.game, ''))) = 'free fire'
     AND v_product.provider_product_id IS NULL THEN
    RAISE EXCEPTION 'El paquete de Free Fire no está vinculado con Central One. No se puede crear el pedido.';
  END IF;

  IF v_product.provider_product_id IS NULL THEN
    IF NEW.provider_product_id IS NOT NULL
       OR NEW.player_id_validation_token IS NOT NULL
       OR coalesce(NEW.player_id_validated, false) THEN
      RAISE EXCEPTION 'No se puede asociar una validación de proveedor a este producto.';
    END IF;
    NEW.provider_product_id := NULL;
    NEW.provider_region := NULL;
    NEW.player_id_validated := false;
    NEW.player_id_validated_at := NULL;
    NEW.player_id_validation_token := NULL;
    RETURN NEW;
  END IF;

  IF NOT v_product.active
     OR NOT coalesce(v_product.provider_validation_supported, false)
     OR lower(coalesce(v_product.provider_status, '')) <> 'active'
     OR v_product.provider_in_stock IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'El paquete no está habilitado para validación y venta.';
  END IF;

  IF NEW.provider_product_id IS DISTINCT FROM v_product.provider_product_id
     OR upper(coalesce(NEW.provider_region, '')) IS DISTINCT FROM upper(coalesce(v_product.provider_region, '')) THEN
    RAISE EXCEPTION 'La región o el producto del pedido no coincide con el catálogo.';
  END IF;

  IF NEW.player_id_validation_token IS NULL THEN
    RAISE EXCEPTION 'Debes verificar el ID del jugador con Central One antes de crear el pedido.';
  END IF;

  v_hash := encode(extensions.digest(convert_to(btrim(NEW.player_id), 'UTF8'), 'sha256'), 'hex');

  SELECT * INTO v_validation
  FROM public.player_id_validations
  WHERE token = NEW.player_id_validation_token
    AND user_id = NEW.user_id
    AND product_id = NEW.product_id
    AND provider_product_id = v_product.provider_product_id
    AND upper(region) = upper(v_product.provider_region)
    AND player_id_hash = v_hash
    AND expires_at > now()
    AND consumed_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La validación del ID caducó, ya fue utilizada o no coincide con el paquete.';
  END IF;

  UPDATE public.player_id_validations
  SET consumed_at = now()
  WHERE token = v_validation.token
    AND consumed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La validación ya fue utilizada. Verifica el ID otra vez.';
  END IF;

  NEW.player_id_validated := true;
  NEW.player_id_validated_at := v_validation.validated_at;
  NEW.player_name := coalesce(nullif(v_validation.player_name, ''), NEW.player_name);
  NEW.provider_product_id := v_product.provider_product_id;
  NEW.provider_region := v_product.provider_region;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.enforce_provider_player_validation() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS zz_enforce_provider_player_validation ON public.orders;

CREATE TRIGGER zz_enforce_provider_player_validation BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION private.enforce_provider_player_validation();
