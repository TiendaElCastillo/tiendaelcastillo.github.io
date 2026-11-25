-- Refresh provider states for submitted orders every minute.
-- The Edge Function authenticates this server-to-server request with the existing
-- central_one_sync_token, and only queries orders that already have a provider ID.
select cron.schedule(
  '*/1 * * * *',
  $job$
    select net.http_post(
      url := 'https://kfllglkfncebpknnugnx.supabase.co/functions/v1/central-one-order',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-sync-token', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'central_one_sync_token'
        )
      ),
      body := '{"action":"sync_open_orders","limit":6}'::jsonb,
      timeout_milliseconds := 50000
    );
  $job$
);
