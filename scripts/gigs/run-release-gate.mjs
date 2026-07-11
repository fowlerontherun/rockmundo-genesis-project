import { spawnSync } from 'node:child_process';
const steps = [
  ['typecheck', ['npm','run','typecheck']],
  ['lint', ['npm','run','lint']],
  ['production build', ['npm','run','build']],
  ['gig DTO/report unit tests', ['npm','run','test:gig-experience:unit']],
  ['replay schema/generator tests', ['npm','run','test:gig-experience:replay']],
  ['viewer engine tests', ['npm','run','test:gig-experience:viewer']],
  ['component tests', ['npm','run','test:gig-experience:component']],
  ['browser smoke/mobile/a11y surrogate tests', ['npm','run','test:gig-experience:browser']],
];
for (const [label, cmd] of steps) {
  console.log(`\n==> ${label}: ${cmd.join(' ')}`);
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`\nRelease gate failed at: ${label}`);
    process.exit(result.status ?? 1);
  }
}
console.log('\nRelease gate completed successfully.');
