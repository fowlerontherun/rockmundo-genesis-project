import { describe, expect, it } from 'vitest';
import { circlePitPosition, circlePitSlots, crowdEventPlan } from './crowdChoreography';

const area = { width: 13, depth: 11, front: 2.15, runway: false };
describe('localized crowd events', () => {
  it('keeps quiet, sparse, reduced-motion, small and television crowds on the floor', () => {
    for (const [density, energy, reaction, reduced, floor, television] of [
      [.2, 1, 'jump', false, area, false], [1, .3, 'bounce', false, area, false],
      [1, 1, 'sway', false, area, false], [1, 1, 'phone_lights', false, area, false],
      [1, 1, 'mosh_pit', true, area, false], [1, 1, 'crowd_surf', false, area, true],
      [1, 1, 'mosh_pit', false, { ...area, runway: true }, false],
      [1, 1, 'mosh_pit', false, { ...area, width: 5 }, false],
    ] as const) {
      const event = crowdEventPlan(26, density, energy, reaction, reduced, floor, television);
      expect(event.pit).toBe(0); expect(event.surf).toBe(0);
    }
  });

  it('responds to replay item progress even outside the ambient event window', () => {
    for (const seconds of [35, 47, 400]) {
      expect(crowdEventPlan(seconds, 1, .6, 'mosh_pit', false, area, false, .5).pit).toBe(1);
      expect(crowdEventPlan(seconds, 1, .6, 'crowd_surf', false, area, false, .5).surf).toBe(1);
      for (const progress of [0, 1]) {
        const event = crowdEventPlan(seconds, 1, 1, 'crowd_surf', false, area, false, progress);
        expect(event.surf).toBe(0);
      }
    }
  });

  it('opens a clear center and spaces runners around the ring without merging bodies', () => {
    const event = crowdEventPlan(12, 1, 1, 'mosh_pit', false, area);
    const fans = Array.from({ length: 14 }, (_, rank) => ({ rank, x: event.centerX + Math.cos(rank * .3) * .9, z: event.centerZ + Math.sin(rank * .3) * .9 }));
    const slots = circlePitSlots(fans, event);
    const positions = fans.map(fan => circlePitPosition(fan.x, fan.z, .5, event, slots.get(fan.rank)));
    for (const [index, position] of positions.entries()) {
      expect(Math.hypot(position.x - event.centerX, position.z - event.centerZ)).toBeGreaterThanOrEqual(event.radius);
      for (const other of positions.slice(index + 1)) expect(Math.hypot(position.x - other.x, position.z - other.z)).toBeGreaterThan(.6);
    }
    const spectator = circlePitPosition(event.centerX + event.radius + .5, event.centerZ, .5, event);
    expect(spectator.running).toBe(0);
    expect(spectator.x - event.centerX).toBeGreaterThanOrEqual(event.radius + .99);
  });
});
