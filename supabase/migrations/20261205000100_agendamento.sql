-- =============================================================================
-- Agendamento da rotina diária (pg_cron + pg_net), todo dia às 7h de Campo Grande
-- (11h UTC). Chama a Edge Function `rotina-diaria`.
--
-- O endereço da função e o segredo ficam no Vault de cada ambiente (não no código):
--   select vault.create_secret('https://<projeto>.supabase.co/functions/v1/rotina-diaria', 'url_rotina_diaria');
--   select vault.create_secret('<segredo igual ao SEGREDO_ROTINA da função>', 'segredo_rotina_diaria');
-- Ver README. Sem esses segredos, o agendamento roda mas não chama nada.
--
-- Em ambientes sem pg_cron/pg_net (ex.: testes com PGlite) este bloco é ignorado.
-- =============================================================================
do $bloco$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;

    perform cron.schedule(
      'rotina-diaria',
      '0 11 * * *',
      $cron$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'url_rotina_diaria'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-segredo-rotina', (select decrypted_secret from vault.decrypted_secrets where name = 'segredo_rotina_diaria')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 60000
        )
        where exists (select 1 from vault.decrypted_secrets where name = 'url_rotina_diaria');
      $cron$
    );
  end if;
end;
$bloco$;
