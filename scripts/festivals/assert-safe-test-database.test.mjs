import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const guard = path.join(__dirname, 'assert-safe-test-database.sh');

function runGuard({ url, confirmed = 'true' } = {}) {
  return spawnSync('bash', [guard, ...(url === undefined ? [] : [url])], {
    encoding: 'utf8',
    env: {
      ...process.env,
      FESTIVAL_TEST_DATABASE_CONFIRMED: confirmed,
      SUPABASE_DB_URL: url ?? '',
    },
  });
}

describe('festival runtime database safety guard', () => {
  it.each([
    'postgresql://postgres:postgres@localhost:54322/postgres',
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    'postgresql://postgres:postgres@supabase_db_rockmundo:5432/postgres',
  ])('allows recognised local test database %s', (url) => {
    expect(runGuard({ url }).status).toBe(0);
  });

  it('rejects a missing database URL', () => {
    const result = runGuard({ url: '', confirmed: 'true' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('database URL is required');
  });

  it('rejects missing confirmation', () => {
    const result = runGuard({ url: 'postgresql://postgres:postgres@localhost:54322/postgres', confirmed: '' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('FESTIVAL_TEST_DATABASE_CONFIRMED=true');
  });

  it('rejects false confirmation', () => {
    expect(runGuard({ url: 'postgresql://postgres:postgres@localhost:54322/postgres', confirmed: 'false' }).status).not.toBe(0);
  });

  it.each([
    'postgresql://postgres:secret@db.supabase.co:5432/postgres',
    'postgresql://postgres:secret@pooler.supabase.com:6543/postgres',
    'postgresql://postgres:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
    'postgresql://postgres:secret@db.yztogmdixmchsmimtent.supabase.co:5432/postgres',
  ])('rejects production-looking Supabase URL %s', (url) => {
    const result = runGuard({ url });
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toContain('secret');
  });
});
