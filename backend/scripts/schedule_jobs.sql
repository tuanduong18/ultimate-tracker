-- Schedule the background jobs with Supabase pg_cron + pg_net.
--
-- pg_cron is only the clock: each job is a POST to the deployed backend, which
-- does the work (app/tasks/jobs.py). Every job is idempotent, so a run that
-- fires twice, late, or after a missed one does no harm.
--
-- Run in the Supabase SQL editor, after:
--   1. this branch is deployed to Render, and
--   2. TASK_SECRET is set in Render's environment.
--
-- Safe to re-run: secrets are updated in place and jobs are replaced by name.
-- Neither the secret nor the URL is stored in this file or in cron.job; both
-- are read from Supabase Vault each time a job fires.

-- 1. Extensions (also under Database → Extensions in the dashboard). ---------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Where to call, and the secret to call with. -----------------------------
-- Replace both values below before running. The URL has no trailing slash.
do $$
declare
    settings constant text[][] := array[
        ['task_base_url', 'https://YOUR-SERVICE.onrender.com'],
        ['task_secret',   'PASTE-THE-TASK_SECRET-FROM-RENDER']
    ];
    existing uuid;
begin
    for i in 1 .. array_length(settings, 1) loop
        if settings[i][2] like '%YOUR-SERVICE%' or settings[i][2] like 'PASTE-%' then
            raise exception 'Fill in % before running this script', settings[i][1];
        end if;
        select id into existing from vault.secrets where name = settings[i][1];
        if existing is null then
            perform vault.create_secret(settings[i][2], settings[i][1]);
        else
            perform vault.update_secret(existing, settings[i][2]);
        end if;
    end loop;
end $$;

-- 3. One function every job calls. -------------------------------------------
-- Render's free tier sleeps when idle and can take about a minute to wake, so
-- the timeout is generous. pg_net does not wait for the answer: check
-- net._http_response for what the backend said (see the end of this file).
create or replace function public.call_task(job text)
returns bigint
language sql
security definer
set search_path = ''
as $$
    select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'task_base_url')
               || '/api/v1/tasks/' || job,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Task-Secret',
            (select decrypted_secret from vault.decrypted_secrets where name = 'task_secret')
        ),
        timeout_milliseconds := 120000
    );
$$;

-- Only pg_cron (running as postgres) calls it; the Data API must not.
revoke all on function public.call_task(text) from public, anon, authenticated;

-- 4. The schedule (UTC). cron.schedule replaces a job of the same name. --------
-- Exchange rates: the provider publishes once a day, around midnight UTC.
select cron.schedule('exchange-rates', '0 1 * * *', $$ select public.call_task('exchange-rates') $$);

-- Subscriptions: renewals, then reminders. Every two hours, so each user's
-- daily countdown changes within two hours of their local midnight.
select cron.schedule('subscriptions', '0 */2 * * *', $$ select public.call_task('subscriptions') $$);

-- 5. Checking it works. --------------------------------------------------------
-- Fire one now instead of waiting:
--   select public.call_task('subscriptions');
-- Did the cron jobs run?
--   select jobname, status, start_time from cron.job_run_details
--   join cron.job using (jobid) order by start_time desc limit 10;
-- What did the backend answer? 200 is good; 401 means the secret does not
-- match TASK_SECRET; 503 means TASK_SECRET is not set on Render.
--   select status_code, content, timed_out, created
--   from net._http_response order by created desc limit 10;
--
-- To stop a job:  select cron.unschedule('subscriptions');
