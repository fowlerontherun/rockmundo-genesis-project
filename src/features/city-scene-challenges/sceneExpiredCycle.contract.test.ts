import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guard the client-side safety UX. The server remains authoritative for all
// scoring, and a stale successful response must never imply an expired cycle
// is still available to earn points.
const source = readFileSync(resolve(process.cwd(), 'src/pages/CitySceneChallenges.tsx'), 'utf8');

describe('City Scene expired cycle presentation', () => {
  it('uses explicit UTC deadline and refresh-independent clock', () => {
    expect(source).toContain('const [clockNow, setClockNow] = useState(() => Date.now())');
    expect(source).toContain('clockNow >= Date.parse(current.ends_at)');
    expect(source).toContain('window.setInterval(tick, 30_000)');
    expect(source).toContain("window.addEventListener('focus', tick)");
    expect(source).toContain('window.clearInterval(timer)');
  });

  it('labels stale cycles and does not suggest further qualifying activities', () => {
    expect(source).toContain('currentExpired && (');
    expect(source).toContain('new activities cannot earn points for it');
    expect(source).toContain('currentExpired ? \'Period ended\'');
    expect(source).toContain('action && !currentExpired');
  });

  it('does not grant points or change any reward gates', () => {
    expect(source).not.toContain("rpc('scene_process_completed_action'");
    expect(source).not.toContain("rpc('claim_scene_reward'");
  });
});
