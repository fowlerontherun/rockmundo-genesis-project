import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const sql = readFileSync(new URL(
  '../../supabase/production-repairs/20261109_weekly_payroll_invocation_gate_4082_MANUAL_ONLY.sql',
  import.meta.url,
), 'utf8');

const count = (regex) => [...sql.matchAll(regex)].length;

test('manual payroll gate is one complete fail-closed transaction', () => {
  assert.equal(count(/^BEGIN;$/gm), 1);
  assert.equal(count(/^COMMIT;$/gm), 1);
  assert.equal(count(/^DO \$preflight\$$/gm), 1);
  assert.equal(count(/^\$preflight\$;$/gm), 1);
  assert.equal(count(/^DO \$postflight\$$/gm), 1);
  assert.equal(count(/^\$postflight\$;$/gm), 1);
  assert.equal(count(/^CREATE FUNCTION public\.process_weekly_band_payroll\(\)$/gm), 1);
  assert.equal(count(/^ALTER FUNCTION public\.process_weekly_band_payroll\(\)$/gm), 1);
  assert.match(sql, /AND btrim\(command\) ~\* '\^SELECT\[\[:space:\]\]\+public\[\.\]process_weekly_band_payroll\[\(\]\[\)\]\[\[:space:\]\]\*;\?\[\[:space:\]\]\*\$'/);
  assert.match(sql, /AND command NOT ILIKE '%http%'/);
  assert.match(sql, /AND command !~\* 'bearer\[\[:space:\]\]\+\|eyJ\[A-Za-z0-9_-\]\{20,\}'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.process_weekly_band_payroll_core_4082\(\)[\s\S]*?service_role/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.process_weekly_band_payroll\(\)[\s\S]*?service_role/);
  assert.doesNotMatch(sql, /\b(?:SELECT|PERFORM)\s+public\.process_weekly_band_payroll\(\)\s*;/i,
    'Operator script must never trigger a real payroll payout');
});

const setup = async (schedule = '0 10 * * 6') => {
  const db = new PGlite();
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE SCHEMA cron;
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT NULL::uuid $$;
    CREATE TABLE cron.job (
      jobname text NOT NULL,
      username text NOT NULL,
      active boolean NOT NULL,
      schedule text NOT NULL,
      command text NOT NULL
    );
    CREATE TABLE public.band_weekly_payroll_settlements (band_id uuid);
    CREATE FUNCTION public.process_weekly_band_payroll()
      RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
      AS $core$
      BEGIN
        -- FROM public.band_treasuries
        -- INSERT INTO public.band_weekly_payroll_settlements
        -- INSERT INTO public.band_earnings
        -- UPDATE public.profiles SET cash
        RAISE EXCEPTION 'PAYOUT FUNCTION MUST NOT RUN IN THIS TEST';
      END;
      $core$;
  `);
  await db.query(`INSERT INTO cron.job (jobname,username,active,schedule,command)
     VALUES ('process-weekly-band-pay','postgres',true,$1,
       'SELECT public.process_weekly_band_payroll();')`,[schedule]);
  return db;
};

test('manual payroll gate installs the wrapper with API execute access denied, no payout', async () => {
  const db = await setup();
  try {
    await db.exec(sql);
    const { rows } = await db.query(`SELECT
      to_regprocedure('public.process_weekly_band_payroll_core_4082()') IS NOT NULL AS core_exists,
      has_function_privilege('service_role','public.process_weekly_band_payroll()','EXECUTE') AS api_can_execute,
      has_function_privilege('service_role','public.process_weekly_band_payroll_core_4082()','EXECUTE') AS api_can_execute_core,
      has_function_privilege('postgres','public.process_weekly_band_payroll()','EXECUTE') AS scheduler_can_execute
    `);
    assert.deepEqual(rows[0], {
      core_exists:true, api_can_execute:false,
      api_can_execute_core:false, scheduler_can_execute:true,
    });
    const { rows: cron } = await db.query(`
      SELECT count(*)::int AS total FROM cron.job WHERE active = true
    `);
    assert.equal(cron[0].total, 1, 'Install must not mutate cron jobs');
  } finally { await db.close(); }
});

test('wrong payroll schedule aborts before renaming or paying', async () => {
  const db = await setup('0 9 * * 6');
  try {
    await assert.rejects(db.exec(sql), /Payroll scheduler identity or routing differs/);
    await db.exec('ROLLBACK;');
    const { rows } = await db.query(`
      SELECT to_regprocedure('public.process_weekly_band_payroll_core_4082()') IS NULL AS no_core,
      to_regprocedure('public.process_weekly_band_payroll()') IS NOT NULL AS original_still_present
    `);
    assert.deepEqual(rows[0], {no_core:true,original_still_present:true});
  } finally { await db.close(); }
});
