import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(__dirname, 'index.ts'), 'utf8');

describe('complete-gig clothing performance integration', () => {
  it('applies the clothing performance resolver before commerce settlement', () => {
    const resolver = source.indexOf('get_band_equipped_clothing_performance_bonus');
    const settlement = source.indexOf("settle_gig_commerce");
    expect(resolver).toBeGreaterThan(-1);
    expect(settlement).toBeGreaterThan(resolver);
  });

  it('keeps the authoritative live rating capped at 25', () => {
    expect(source).toContain("Math.min(25, avgRating * (1 + clothingPerformancePct / 100))");
  });

  it('persists clothing performance audit data on the gig outcome', () => {
    expect(source).toContain('clothing_performance: clothingPerformanceAudit');
    expect(source).toContain('rating_before');
    expect(source).toContain('rating_after');
  });
});