import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page = readFileSync(resolve(process.cwd(), 'src/pages/CitySceneChallenges.tsx'), 'utf8');

// DOM and Node overloads coexist in this project. ReturnType<typeof
// window.setTimeout> can resolve to NodeJS.Timeout, but invoking the browser
// window.setTimeout produces a numeric ID. The page must declare number.
describe('City Scene browser deadline timer typing', () => {
  it('stores the DOM timer ID as number and clears it on effect cleanup', () => {
    expect(page).toContain('let timeout: number | undefined;');
    expect(page).toContain('timeout = window.setTimeout(checkDeadline,');
    expect(page).toContain('window.clearTimeout(timeout)');
    expect(page).not.toContain('ReturnType<typeof window.setTimeout>');
    expect(page).not.toContain('ReturnType<typeof setTimeout>');
  });
});
