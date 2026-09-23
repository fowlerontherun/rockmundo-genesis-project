import { describe, expect, it } from 'vitest';
import { defaultAppearance } from './appearance';
import { resolveGigStageAppearances } from './usePlayerModel';

const STAGE_ID = '11111111-1111-4111-8111-111111111111';
const LEGACY_ID = '22222222-2222-4222-8222-222222222222';

describe('gig player appearance resolution', () => {
  it('preserves Avatar V2 body options and Topless from saved stage appearances', () => {
    const appearance = defaultAppearance(STAGE_ID);
    appearance.body.frame = 'feminine';
    appearance.body.muscle = 'bodybuilder';
    appearance.equipment.top.itemId = 'starter.top.topless';

    const result = resolveGigStageAppearances([
      { profile_id: STAGE_ID, appearance },
    ]);

    expect(result[STAGE_ID].body).toMatchObject({ frame: 'feminine', muscle: 'bodybuilder' });
    expect(result[STAGE_ID].equipment.top.itemId).toBe('starter.top.topless');
  });

  it('uses the legacy avatar only when a saved stage appearance is absent', () => {
    const stageAppearance = defaultAppearance(STAGE_ID);
    stageAppearance.body.muscle = 'athletic';
    stageAppearance.equipment.top.itemId = 'starter.top.topless';

    const result = resolveGigStageAppearances(
      [{ profile_id: STAGE_ID, appearance: stageAppearance }],
      [
        { profile_id: STAGE_ID, gender: 'male', skin_tone: '#a06f4f', hair_color: '#30241d', height: 170, shirt_color: '#112233', pants_color: '#223344', shoes_color: '#334455' },
        { profile_id: LEGACY_ID, gender: 'female', skin_tone: '#d4a373', hair_color: '#54372a', height: 178, shirt_color: '#bd3548', pants_color: '#272e39', shoes_color: '#25232b' },
      ],
    );

    expect(result[STAGE_ID].body.muscle).toBe('athletic');
    expect(result[STAGE_ID].equipment.top.itemId).toBe('starter.top.topless');
    expect(result[LEGACY_ID].body.frame).toBe('feminine');
    expect(result[LEGACY_ID].equipment.top.color).toBe('#bd3548');
  });

  it('upgrades older saved appearances that predate muscle definition', () => {
    const legacyStageAppearance = defaultAppearance(STAGE_ID);
    delete legacyStageAppearance.body.muscle;

    const result = resolveGigStageAppearances([
      { profile_id: STAGE_ID, appearance: legacyStageAppearance },
    ]);

    expect(result[STAGE_ID].body.muscle).toBe('natural');
  });
});
