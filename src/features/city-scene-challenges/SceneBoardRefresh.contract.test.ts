import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page = readFileSync(
  resolve(process.cwd(), 'src/pages/CitySceneChallenges.tsx'), 'utf8',
);

describe('City Scene background refresh contract', () => {
  it('keeps the current community board visible during an in-place refresh', () => {
    expect(page).toContain('const initialCityLoad = lastLoadedCity.current !== cityId;');
    expect(page).toContain('if (initialCityLoad) {\n      setLoading(true);\n      setBoard(null);');
    expect(page).toContain('setRefreshing(true);');
    expect(page).toContain('lastLoadedCity.current = cityId;');
    expect(page).toContain('setRefreshError(true);');
    expect(page).toContain('Showing the last confirmed city progress');
  });

  it('refreshes long-lived foreground boards after a verified worker interval, not every render', () => {
    expect(page).toContain("if (document.visibilityState === 'hidden') return;");
    expect(page).toContain('now - lastRefreshAt < 15 * 60_000');
    expect(page).toContain("window.addEventListener('focus', refreshIfStale)");
    expect(page).toContain("window.removeEventListener('focus', refreshIfStale)");
    expect(page).toContain('window.clearInterval(timer)');
    expect(page).toContain('handledCycleIds.current.add(next.id)');
    // Browser window.setTimeout returns a numeric ID even when Node types are
    // present in the shared TypeScript project. The timer must be clearable.
    expect(page).toContain('let timeout: ReturnType<typeof window.setTimeout> | undefined;');
    expect(page).toContain('timeout = window.setTimeout(checkDeadline,');
    expect(page).toContain('window.clearTimeout(timeout)');
  });

  it('does not award points or override the server response when a deadline arrives', () => {
    expect(page).toContain("rpc('get_city_scene_board'");
    expect(page).toContain('setRefresh((n) => n + 1)');
    expect(page).not.toContain('setScenePoints(');
    expect(page).not.toContain('scene_grant_earned_xp(');
  });
});
