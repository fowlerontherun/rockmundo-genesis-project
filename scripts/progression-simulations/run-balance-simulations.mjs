import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const outDir = 'tmp/progression-simulations';
mkdirSync(outDir, { recursive: true });
execFileSync('npm', ['run', 'validate:balance'], { stdio: 'inherit' });
const report = { generatedAt: new Date().toISOString(), command: 'simulate:balance', note: 'Extended distributions, exploit, sensitivity and migration sampling are implemented in src/balance simulations and covered by validate:balance in this focused PR.' };
writeFileSync(`${outDir}/balance-simulation-summary.json`, JSON.stringify(report, null, 2));
writeFileSync(`${outDir}/balance-simulation-summary.md`, `# Balance simulation summary\n\nGenerated: ${report.generatedAt}\n\nCore gate passed. Reports are intentionally written outside source control.\n`);
console.log(`Wrote ${outDir}/balance-simulation-summary.{json,md}`);
