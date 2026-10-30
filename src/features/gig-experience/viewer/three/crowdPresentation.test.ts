import { describe, expect, it } from 'vitest';
import { crowdPresentation } from './crowdPresentation';
import { makeStageReplay } from './test-fixtures';

describe('crowd presentation timeline', () => {
  it('reconstructs reaction changes and temporary item expiry after backwards seeks', async () => {
    const replay = await makeStageReplay();
    const base = replay.events[0];
    const events = [
      { ...base, scheduledOffsetMs: 0, durationMs: 1000, visualPayload: { type: 'crowd_reaction' as const, reaction: 'bounce' as const, intensity: .7 } },
      { ...base, scheduledOffsetMs: 2000, durationMs: 1000, visualPayload: { type: 'performance_item' as const, itemId: 'phones', name: 'Phones', category: 'crowd', action: 'phone_lights' as const, performerId: null, intensity: 1 } },
    ];
    expect(crowdPresentation(events, 2000)).toMatchObject({ crowdReaction: 'phone_lights', crowdPreviousReaction: 'bounce', crowdReactionElapsed: 0 });
    expect(crowdPresentation(events, 3100)).toMatchObject({ crowdReaction: 'bounce', crowdPreviousReaction: 'phone_lights', crowdReactionElapsed: .1 });
    const before = crowdPresentation(events, 2200);
    crowdPresentation(events, 9000);
    expect(crowdPresentation(events, 2200)).toEqual(before);
    expect(crowdPresentation(events, 9000).crowdReaction).toBe('bounce');
    expect(crowdPresentation(events, 5000, 5000)).toMatchObject({ crowdReaction: 'applause', crowdPreviousReaction: 'bounce', crowdReactionElapsed: 0 });
    expect(crowdPresentation(events, 7500, 5000)).toMatchObject({ crowdReaction: 'bounce', crowdPreviousReaction: 'applause', crowdReactionElapsed: .1 });
  });
});
