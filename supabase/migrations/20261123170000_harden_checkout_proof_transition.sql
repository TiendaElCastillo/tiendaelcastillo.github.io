-- Hardening for direct-payment checkout submission.
-- A direct order may enter payment_review only after its uploaded image exists
-- in Storage and every payment-method-specific field is present and consistent.
CREATE OR REPLACE FUNCTION public.guard_order_status_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_sender_digits text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.payment_source = 'direct'
       AND NEW.status IN ('payment_review','processing','completed') THEN
      IF NEW.proof_path IS NULL
         OR NOT EXISTS (
           SELECT 1
           FROM storage.objects so
           WHERE so.bucket_id = 'payment-proofs'
             AND so.name = NEW.proof_path
         ) THEN
        RAISE EXCEPTION 'Este pedido no puede avanzar: falta la captura recibida por el servidor.';
      END IF;
    END IF;

    IF OLD.payment_source = 'direct'
       AND NEW.status = 'payment_review' THEN
      v_sender_digits := regexp_replace(coalesce(NEW.payment_sender_phone,''), '[^0-9]', '', 'g');

      IF NEW.payment_method = 'Transferencia CUP' THEN
        IF NEW.payment_reference IS NULL
           OR length(btrim(NEW.payment_reference)) < 3
           OR length(btrim(NEW.payment_reference)) > 100
           OR v_sender_digits !~ '^53[56][0-9]{7}$'
           OR NEW.payment_reported_amount IS NOT NULL THEN
          RAISE EXCEPTION 'No se puede enviar a revisión: completa el número de transacción y el móvil de origen.';
        END IF;

      ELSIF NEW.payment_method = 'Saldo móvil' THEN
        IF NEW.payment_reference IS NOT NULL
           OR v_sender_digits !~ '^53[56][0-9]{7}$'
           OR NEW.payment_reported_amount IS NULL
           OR NEW.payment_reported_amount <= 0
           OR abs(NEW.payment_reported_amount - NEW.price) > 0.01 THEN
          RAISE EXCEPTION 'No se puede enviar a revisión: completa el móvil remitente y el importe exacto del saldo móvil.';
        END IF;

      ELSIF NEW.payment_method = 'USDT' THEN
        IF NEW.payment_reference IS NULL
           OR NEW.payment_reference !~ '^[A-Fa-f0-9]{64}$'
           OR NEW.payment_reported_amount IS NULL
           OR NEW.payment_reported_amount <= 0
           OR abs(NEW.payment_reported_amount - NEW.price) > 0.000001
           OR nullif(btrim(coalesce(NEW.payment_sender_phone,'')), '') IS NOT NULL THEN
          RAISE EXCEPTION 'No se puede enviar a revisión: completa el TxID y la cantidad exacta de USDT.';
        END IF;

      ELSE
        RAISE EXCEPTION 'Este método de pago no admite revisión de comprobantes.';
      END IF;
    END IF;

    IF OLD.payment_source = 'direct'
       AND OLD.status = 'payment_review'
       AND NEW.status = 'processing'
       AND NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;

    IF OLD.payment_source = 'wallet'
       AND NEW.status = 'processing'
       AND NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
