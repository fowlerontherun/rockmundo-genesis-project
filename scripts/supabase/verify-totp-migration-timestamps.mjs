import { readdir } from "node:fs/promises";
import path from "node:path";

const migrationDir = path.resolve("supabase/migrations");
const files = (await readdir(migrationDir))
  .filter((name) => /^\d{14}_.+\.sql$/.test(name))
  .sort();

const now = Date.now();
const maxFutureMs = 2 * 24 * 60 * 60 * 1000;
const byTimestamp = new Map();
const errors = [];

function isTotp(name) {
  return /(?:^|_)(?:totp|top_of_the_pops)(?:_|\.)/i.test(name);
}

function timestampToDate(timestamp) {
  const year = Number(timestamp.slice(0, 4));
  const month = Number(timestamp.slice(4, 6)) - 1;
  const day = Number(timestamp.slice(6, 8));
  const hour = Number(timestamp.slice(8, 10));
  const minute = Number(timestamp.slice(10, 12));
  const second = Number(timestamp.slice(12, 14));
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

for (const file of files) {
  const timestamp = file.slice(0, 14);
  const group = byTimestamp.get(timestamp) ?? [];
  group.push(file);
  byTimestamp.set(timestamp, group);

  if (isTotp(file)) {
    const date = timestampToDate(timestamp);
    if (!Number.isFinite(date.getTime())) {
      errors.push(`${file}: invalid migration timestamp`);
    } else if (date.getTime() > now + maxFutureMs) {
      errors.push(`${file}: TOTP migration timestamp is more than two days in the future`);
    }
  }
}

for (const [timestamp, group] of byTimestamp) {
  if (group.length > 1 && group.some(isTotp)) {
    errors.push(`${timestamp}: duplicate timestamp touches TOTP: ${group.join(", ")}`);
  }
}

if (errors.length) {
  console.error("TOTP migration timestamp verification failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const totpCount = files.filter(isTotp).length;
console.log(`TOTP migration timestamp verification passed (${totpCount} migrations checked).`);
