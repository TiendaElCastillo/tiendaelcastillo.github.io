-- Poll Central One order states more frequently without changing order submission.
-- PostgreSQL 15.1.1.61+ supports pg_cron schedules in seconds; production is 17.11.
-- Keep the same authenticated Edge Function, six-order batch and idempotent submit path.
DO $migration$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE active
    AND command ILIKE '%/functions/v1/central-one-order%'
    AND command ILIKE '%sync_open_orders%'
  ORDER BY jobid DESC
  LIMIT 1;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el trabajo activo de seguimiento de pedidos de Central One.';
  END IF;

  IF (
    SELECT count(*)
    FROM cron.job
    WHERE active
      AND command ILIKE '%/functions/v1/central-one-order%'
      AND command ILIKE '%sync_open_orders%'
  ) <> 1 THEN
    RAISE EXCEPTION 'Se encontró más de un trabajo de seguimiento activo; no se cambió la frecuencia para evitar consultas duplicadas.';
  END IF;

  PERFORM cron.alter_job(
    job_id := v_job_id,
    schedule := '20 seconds'
  );

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications';
  END IF;
END;
$migration$;
