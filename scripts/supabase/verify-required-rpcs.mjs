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
  ...[
    'publish_festival_staff_vacancy', 'apply_for_festival_staff_vacancy',
    'withdraw_festival_staff_application', 'review_festival_staff_application',
    'hire_festival_staff_applicant', 'hire_festival_npc_staff',
    'assign_festival_staff_shift', 'cancel_festival_staff_assignment',
    'publish_festival_supplier_requirement', 'submit_festival_supplier_quote',
    'withdraw_festival_supplier_quote', 'review_festival_supplier_quote',
    'accept_festival_supplier_quote', 'cancel_festival_supplier_contract',
    'refresh_festival_npc_supplier_quotes',
  ].map((name) => ({ name, arguments: [{ name: 'p_payload', type: 'jsonb' }, { name: 'p_idempotency_key', type: 'uuid' }] })),
  { name: 'get_available_festival_staff_vacancies', arguments: [{ name: 'p_filters', type: 'jsonb' }] },
  { name: 'get_available_festival_supplier_opportunities', arguments: [{ name: 'p_filters', type: 'jsonb' }] },
  { name: 'get_festival_sponsorship_plan', arguments: [{ name: 'p_festival_company_id', type: 'uuid' }] },
  { name: 'save_festival_sponsorship_plan', arguments: [{ name: 'p_festival_company_id', type: 'uuid' }, { name: 'p_expected_version', type: 'integer' }, { name: 'p_plan', type: 'jsonb' }, { name: 'p_packages', type: 'jsonb' }, { name: 'p_inventory', type: 'jsonb' }, { name: 'p_idempotency_key', type: 'uuid' }, { name: 'p_complete', type: 'boolean' }] },
  { name: 'get_available_festival_sponsorship_opportunities', arguments: [{ name: 'p_filters', type: 'jsonb' }] },
  ...[
    'open_festival_sponsor_applications','close_festival_sponsor_applications','submit_festival_sponsor_application','withdraw_festival_sponsor_application','review_festival_sponsor_application','send_festival_sponsor_invitation','respond_to_festival_sponsor_invitation','create_festival_sponsor_proposal','send_festival_sponsor_proposal','counter_festival_sponsor_proposal','respond_to_festival_sponsor_proposal','withdraw_festival_sponsor_proposal','cancel_festival_sponsor_contract','refresh_festival_npc_sponsor_prospects','search_festival_sponsor_prospects',
  ].map((name) => ({ name, arguments: [{ name: 'p_payload', type: 'jsonb' }, { name: 'p_idempotency_key', type: 'uuid' }] })),
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

const completion = readFileSync(join(migrationDir, '20291217161000_complete_festival_staffing_supplier_workflows.sql'), 'utf8');
for (const name of requiredRpcs.slice(-17, -2).map((rpc) => rpc.name)) {
  const definitions = [...completion.matchAll(new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${name}\\b([\\s\\S]*?)(?=CREATE\\s+OR\\s+REPLACE\\s+FUNCTION|$)`, 'gi'))];
  const body = definitions.at(-1)?.[1] ?? '';
  if (/festival_operations_action_not_implemented|not\s+implemented/i.test(body)) missing.push(`public.${name} still contains a bounded placeholder`);
}

if (missing.length > 0) {
  console.error('Required Supabase RPC contract verification failed:');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Verified ${requiredRpcs.length} required frontend RPC contract(s) against Supabase migrations.`);
