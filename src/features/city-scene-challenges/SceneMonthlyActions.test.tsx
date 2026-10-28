import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SceneMonthlyActions } from './SceneMonthlyActions';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Monthly City Scene launch pathways', () => {
  it('links players to real verified activities without claiming page visits earn points', () => {
    const html = renderToStaticMarkup(<MemoryRouter><SceneMonthlyActions /></MemoryRouter>);
    expect(html).toContain('/gig-booking');
    expect(html).toContain('/recording-studio');
    expect(html).toContain('/rehearsals');
    expect(html).toContain('Only completed events');
    expect(html).toContain('booking or opening a page never earns scene points');
    expect(html).not.toContain('XP awarded');
  });

  it('uses real monthly objective and non-user-controlled, server-verified sources', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/pages/CitySceneChallenges.tsx'), 'utf8');
    expect(page).toContain("active === 'monthly' && !currentExpired && <SceneMonthlyActions />");
    expect(page).toContain('action && !currentExpired');
    expect(page).toContain('clockNow >= Date.parse(current.ends_at)');
    expect(page).toContain('<SceneCycleCountdown endsAt={current.ends_at} />');
    expect(page).toContain('handledCycleIds.current.add(next.id)');
    expect(page).toContain('findNextSceneCycleExpiry(board.cycles, handledCycleIds.current)');
    expect(page).toContain('2026-11-01T00:00:00Z');
    expect(page).not.toContain('No points or rewards are available yet');
  });
});
