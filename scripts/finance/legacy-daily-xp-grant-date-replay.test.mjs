import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const readMigration = name =>
  readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

const dailyGrants = readMigration('20250921111329_add_daily_xp_allocation.sql');
const septemberStipend = readMigration('20250926105313_update_profile_daily_xp_grants.sql');
const xpWallet = readMigration('20250918160448_create_xp_tables.sql');
const gameBalance = readMigration('20251216081506_9f11e417-e592-4489-ba1d-0b90796af42d.sql');
const januaryDualXp = readMigration('20260128080103_ad0169d5-495f-4cce-8717-b002ab85c3c6.sql');

function tableStatement(migration, table) {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `CREATE TABLE (?:IF NOT EXISTS )?public\\.${escaped} \\([\\s\\S]*?\\n\\);`,
  );
  const sql = migration.match(pattern)?.[0];
  assert.ok(sql, `Cannot find historical definition for ${table}`);
  return sql;
}

test('January dual-XP migration replays after September drops daily grant created_at', async () => {
  assert.match(septemberStipend, /DROP COLUMN IF EXISTS created_at/);
  assert.match(septemberStipend, /ADD COLUMN IF NOT EXISTS claimed_at timestamptz/);
  assert.doesNotMatch(januaryDualXp, /DATE\(created_at\)/);
  assert.match(januaryDualXp, /SET grant_date = DATE\(claimed_at\)/);

  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE public.profiles (id uuid PRIMARY KEY)');
    await db.exec(tableStatement(dailyGrants, 'profile_daily_xp_grants'));
    await db.exec(tableStatement(xpWallet, 'player_xp_wallet'));
    await db.exec(tableStatement(gameBalance, 'game_balance_config'));

    await db.exec(`
      INSERT INTO public.profiles (id) VALUES
        ('00000000-0000-0000-0000-000000000011'),
        ('00000000-0000-0000-0000-000000000012');

      -- The historical table has no created_at after the Sept 26 alignment.
      -- Allow one legacy NULL grant_date to exercise January's backfill path.
      ALTER TABLE public.profile_daily_xp_grants ALTER COLUMN grant_date DROP NOT NULL;
      INSERT INTO public.profile_daily_xp_grants
        (profile_id, grant_date, xp_awarded, claimed_at)
      VALUES
        ('00000000-0000-0000-0000-000000000011', NULL, 150, '2026-01-14T09:30:00Z'),
        ('00000000-0000-0000-0000-000000000012', '2026-01-10', 150, '2026-01-15T09:30:00Z');

      INSERT INTO public.player_xp_wallet (profile_id, xp_balance, lifetime_xp, xp_spent)
      VALUES ('00000000-0000-0000-0000-000000000011', 100, 250, 50);
    `);

    await db.exec(januaryDualXp);

    const { rows: grants } = await db.query(`
      SELECT grant_date::text AS grant_date, claimed_at::date::text AS claimed_day
      FROM public.profile_daily_xp_grants ORDER BY profile_id
    `);
    assert.deepEqual(grants, [
      { grant_date: '2026-01-14', claimed_day: '2026-01-14' },
      { grant_date: '2026-01-10', claimed_day: '2026-01-15' },
    ]);

    const { rows: wallets } = await db.query(`
      SELECT skill_xp_balance, skill_xp_lifetime, skill_xp_spent
      FROM public.player_xp_wallet
      WHERE profile_id = '00000000-0000-0000-0000-000000000011'
    `);
    assert.deepEqual(wallets, [{
      skill_xp_balance: 100,
      skill_xp_lifetime: 250,
      skill_xp_spent: 50,
    }]);

    const { rows: config } = await db.query(`
      SELECT COUNT(*)::integer AS count FROM public.game_balance_config
      WHERE category = 'dual_xp'
    `);
    assert.ok(config[0].count >= 15, 'Dual XP configuration must still be seeded');
  } finally {
    await db.close();
  }
});
