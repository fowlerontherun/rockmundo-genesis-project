#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), 'utf8');
const fail = [];
const warn = [];
const skillCatalogue = read('src/utils/skillCatalogue.ts');
const balance = read('src/utils/progressionBalance.ts');
const attrs = read('src/utils/attributeProgression.ts');

function extractArrayObjects(source, name) {
  const start = source.indexOf(`export const ${name}`);
  if (start < 0) return [];
  const next = source.indexOf('\nexport ', start + 20);
  return source.slice(start, next < 0 ? source.length : next);
}
function collectSlugs() {
  const block = extractArrayObjects(skillCatalogue, 'CANONICAL_SKILLS');
  return [...block.matchAll(/slug:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]*)"[\s\S]*?description:\s*"([^"]*)"[\s\S]*?category:\s*"([^"]*)"[\s\S]*?tier:\s*"([^"]+)"[\s\S]*?skill_type:\s*"([^"]+)"[\s\S]*?is_active:\s*(true|false)[\s\S]*?is_practiceable:\s*(true|false)[\s\S]*?max_level:\s*(\d+)[\s\S]*?progression_curve_key:\s*"([^"]+)"/g)]
    .map((m) => ({ slug: m[1], name: m[2], description: m[3], category: m[4], tier: m[5], type: m[6], active: m[7] === 'true', practiceable: m[8] === 'true', max: Number(m[9]), curve: m[10] }));
}
const skills = collectSlugs();
const active = skills.filter((s) => s.active);
const slugs = new Set(skills.map((s) => s.slug));
if (skills.length === 0) fail.push('No canonical skills parsed.');
for (const s of active) {
  for (const key of ['slug','name','description','category','tier','type','curve']) if (!s[key]) fail.push(`${s.slug} missing ${key}`);
  if (s.max <= 0) fail.push(`${s.slug} has invalid max_level`);
}
const duplicates = skills.map((s) => s.slug).filter((s, i, a) => a.indexOf(s) !== i);
if (duplicates.length) fail.push(`Duplicate skill slugs: ${[...new Set(duplicates)].join(', ')}`);

for (const constant of ['getXpRequiredForLevel','getXpRequiredForNextLevel','getCumulativeXpForSkillLevel','getLevelFromLifetimeXp','getProgressWithinLevel','getAttributeUpgradeCost','getDiminishingAttributeEffect']) {
  if (!balance.includes(`export const ${constant}`) && !balance.includes(`export function ${constant}`)) fail.push(`Missing authoritative progression helper ${constant}`);
}
for (const key of ['dailySessionLimit','baseXpPerHour','totalAttributeBonusCap']) if (!balance.includes(key)) fail.push(`Missing balance rule ${key}`);

const attrLinks = extractArrayObjects(skillCatalogue, 'CANONICAL_ATTRIBUTE_LINKS');
const systemLinks = extractArrayObjects(skillCatalogue, 'CANONICAL_SYSTEM_LINKS');
const roleLinks = extractArrayObjects(skillCatalogue, 'CANONICAL_ROLE_LINKS');
const unlockRoutes = extractArrayObjects(skillCatalogue, 'CANONICAL_UNLOCK_ROUTES');
for (const s of active) {
  if (!attrLinks.includes(`"${s.slug}"`)) fail.push(`${s.slug} has no explicit attribute learning link; regex fallback is not allowed for active skills.`);
  if (!systemLinks.includes(`"${s.slug}"`)) fail.push(`${s.slug} has no explicit system link.`);
  if (!unlockRoutes.includes('CANONICAL_SKILLS.map') && !unlockRoutes.includes(`"${s.slug}"`)) fail.push(`${s.slug} has no unlock route.`);
}

const attributeKeysBlock = extractArrayObjects(attrs, 'FULL_ATTRIBUTE_KEYS');
const metadataBlock = extractArrayObjects(attrs, 'FULL_ATTRIBUTE_METADATA');
const attributeKeys = [...attributeKeysBlock.matchAll(/['"]([a-z0-9_]+)['"]/g)].map((m) => m[1]);
if (!attributeKeys.length) fail.push('No active attributes parsed.');
for (const key of attributeKeys) {
  if (!metadataBlock.includes(`${key}:`)) fail.push(`Attribute ${key} is missing metadata.`);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(join(root, dir))) {
    if (['node_modules','.git','dist','coverage'].includes(entry)) continue;
    const full = join(root, dir, entry); const st = statSync(full);
    if (st.isDirectory()) walk(relative(root, full), out); else if (/\.(ts|tsx|js|jsx|mjs|sql)$/.test(entry)) out.push(relative(root, full));
  }
  return out;
}
const files = walk('src').concat(walk('supabase')).concat(walk('scripts'));
const rawSlugDisplay = [];
const regexSkillFallback = [];
const duplicateFormula = [];
for (const file of files) {
  const text = read(file);
  if (/skill_slug\s*\.\s*replace\s*\(/i.test(text)) rawSlugDisplay.push(file);
  if (/skill.*(startsWith|match|RegExp)|category.*infer|slug.*startsWith/i.test(text) && !file.endsWith('validate-programme.mjs')) regexSkillFallback.push(file);
  if (file !== 'src/utils/progressionBalance.ts' && /perLevelXp|Math\.pow\([^\n]*(xp|XP)|xpRequired|XP_REQUIRED|levelFrom.*XP/i.test(text)) duplicateFormula.push(file);
}
if (rawSlugDisplay.length) fail.push(`Raw slug display fallback candidates found: ${rawSlugDisplay.join(', ')}`);
if (regexSkillFallback.length) warn.push(`Potential legacy regex/category inference candidates to review: ${regexSkillFallback.join(', ')}`);
if (duplicateFormula.length) warn.push(`Potential duplicate XP formula candidates to review: ${duplicateFormula.join(', ')}`);

const requiredDocs = [
  'docs/progression/SKILLS_ATTRIBUTES_PROGRAMME_FINAL_AUDIT.md',
  'docs/progression/SKILLS_ATTRIBUTES_ARCHITECTURE.md',
  'docs/progression/SKILLS_ATTRIBUTES_MIGRATION_FINAL_REVIEW.md',
  'docs/progression/SKILLS_ATTRIBUTES_OPERATIONS_RUNBOOK.md',
  'docs/progression/ADDING_SKILLS_AND_ATTRIBUTES.md',
  'docs/progression/PROGRESSION_DEPRECATION_REGISTER.md',
  'docs/progression/SKILLS_ATTRIBUTES_PROGRAMME_COMPLETION_REPORT.md',
];
for (const doc of requiredDocs) { try { if (read(doc).length < 500) fail.push(`${doc} is too small to be a useful audit document.`); } catch { fail.push(`Missing ${doc}`); } }

console.log(JSON.stringify({ command: 'validate:progression-programme', activeSkillCount: active.length, activeAttributeCount: attributeKeys.length, warnings: warn, failures: fail }, null, 2));
if (fail.length) process.exit(1);
