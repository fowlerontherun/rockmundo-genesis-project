import { readdirSync } from "node:fs";
import { join } from "node:path";

const migrationDirectory = join(process.cwd(), "supabase", "migrations");
const filenamePattern = /^(\d{14})_.+\.sql$/;
const totpPattern = /(totp|top_of_the_pops)/i;
const files = readdirSync(migrationDirectory).filter((name) => name.endsWith(".sql"));
const allByTimestamp = new Map();
const failures = [];
const now = new Date();
const reasonableFuture = new Date(Date.UTC(
  now.getUTCFullYear(),
  now.getUTCMonth(),
  now.getUTCDate() + 2,
  23, 59, 59,
));

for (const filename of files) {
  const match = filename.match(filenamePattern);
  if (!match) continue;
  const stamp = match[1];
  const timestampFiles = allByTimestamp.get(stamp) ?? [];
  timestampFiles.push(filename);
  allByTimestamp.set(stamp, timestampFiles);
}

for (const filename of files.filter((name) => totpPattern.test(name))) {
  const match = filename.match(filenamePattern);
  if (!match) {
    failures.push(`${filename}: expected YYYYMMDDHHMMSS_description.sql`);
    continue;
  }

  const stamp = match[1];
  const parts = stamp.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!parts) {
    failures.push(`${filename}: invalid timestamp`);
    continue;
  }

  const parsed = new Date(Date.UTC(
    Number(parts[1]),
    Number(parts[2]) - 1,
    Number(parts[3]),
    Number(parts[4]),
    Number(parts[5]),
    Number(parts[6]),
  ));
  const roundTrip = `${parsed.getUTCFullYear()}${String(parsed.getUTCMonth() + 1).padStart(2, "0")}${String(parsed.getUTCDate()).padStart(2, "0")}${String(parsed.getUTCHours()).padStart(2, "0")}${String(parsed.getUTCMinutes()).padStart(2, "0")}${String(parsed.getUTCSeconds()).padStart(2, "0")}`;

  if (roundTrip !== stamp) {
    failures.push(`${filename}: timestamp is not a real calendar time`);
    continue;
  }
  if (parsed > reasonableFuture) {
    failures.push(`${filename}: timestamp is unreasonably beyond the current date`);
  }

  const colliding = allByTimestamp.get(stamp) ?? [];
  if (colliding.length > 1) {
    failures.push(`${stamp}: TOTP migration collides with ${colliding.sort().join(", ")}`);
  }
}

if (failures.length) {
  console.error("Top of the Pops migration verification failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

const totpCount = files.filter((name) => totpPattern.test(name)).length;
console.log(`Verified ${totpCount} Top of the Pops migration filename timestamp(s): valid, current and globally unique.`);
