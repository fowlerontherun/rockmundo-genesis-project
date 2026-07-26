import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const requiredRpcs = [
  {
    name: 'get_banking_dashboard',
    arguments: [],
  },
  {
    name: 'festival_owner_management_bootstrap',
    arguments: [{ name: 'p_identifier', type: 'uuid' }],
    references: ['FESTIVAL_OWNER_BOOTSTRAP_RPC'],
  },
  ...[
    'submit_festival_artist_application', 'withdraw_festival_artist_application',
    'review_festival_artist_application', 'send_festival_artist_invitation',
    'respond_to_festival_artist_invitation', 'create_festival_artist_offer',
    'send_festival_artist_offer', 'counter_festival_artist_offer',
    'respond_to_festival_artist_offer', 'withdraw_festival_artist_offer',
    'cancel_festival_artist_booking', 'get_my_festival_artist_opportunities',
    'search_festival_artist_candidates',
  ].map((name) => ({ name, arguments: [] })),
];

const migrationDir = join(root, 'supabase', 'migrations');
const migrations = readdirSync(migrationDir)
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(join(migrationDir, file), 'utf8'))
  .join('\n');

const sourceText = ['src', 'docs']
  .flatMap((dir) => readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx|md)$/.test(entry.name))
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8')))
  .join('\n');

const missing = [];
for (const rpc of requiredRpcs) {
  const isReferenced = [rpc.name, ...(rpc.references ?? [])].some((needle) => sourceText.includes(needle));
  if (!isReferenced) {
    missing.push(`${rpc.name} is no longer referenced; remove it from requiredRpcs if intentionally retired`);
    continue;
  }

  const args = rpc.arguments ?? [];
  const signatureBody = args.length === 0
    ? '\\s*'
    : args.map((arg) => `${arg.name}\\s+${arg.type}\\b`).join('[\\s\\S]*?,[\\s\\S]*?');
  const signature = new RegExp(
    `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${rpc.name}\\s*\\(${signatureBody}`,
    'i',
  );
  if (!signature.test(migrations)) {
    const renderedArgs = args.map((arg) => `${arg.name} ${arg.type}`).join(', ');
    missing.push(`public.${rpc.name}(${renderedArgs}) is absent from Supabase migrations`);
  }
}

if (missing.length > 0) {
  console.error('Required Supabase RPC contract verification failed:');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Verified ${requiredRpcs.length} required frontend RPC contract(s) against Supabase migrations.`);
