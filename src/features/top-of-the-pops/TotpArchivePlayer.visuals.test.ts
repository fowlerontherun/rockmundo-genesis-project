import { describe, expect, it } from 'vitest';
import type { TotpArchivedBandMember, TotpBroadcastReplay } from './api';
import { archivedPlayerModels } from './TotpArchivePlayer';

const PROFILE_ID = '11111111-1111-4111-8111-111111111111';

function replayWithMember(member: TotpArchivedBandMember): TotpBroadcastReplay {
  return {
    id: 'replay-1',
    performance_id: 'perf-1',
    replay_version: 4,
    stage_key: 'main_stage',
    presenter_key: 'alex_rayne',
    duration_ms: 198000,
    checksum: 'abcdef123456',
    generated_at: '2026-09-17T20:00:00Z',
    payload: {
      schemaVersion: 1,
      episodeId: 'episode-1', episodeNumber: 1, episodeDate: '2026-09-17', broadcastAt: '2026-09-17T20:00:00Z',
      performanceId: 'perf-1', runningOrder: 1, presenterKey: 'alex_rayne',
      band: { id: 'band-1', name: 'Test Band', members: [member] },
      song: { id: 'song-1', title: 'Test Song', genre: 'rock', qualifyingRank: 10 },
      stage: 'main_stage', performanceDurationMs: 187000, totalDurationMs: 198000, cues: [],
    },
  };
}

describe('Top of the Pops archived performer visuals', () => {
  it('uses the frozen stage appearance instead of deriving a current player model', () => {
    const appearance = {
      version: 1,
      body: { frame: 'feminine', height: 1.04, build: 1, muscle: 'bodybuilder', skin: '#edc7a5' },
      head: { style: 'punk', hair: '#54372a' },
      equipment: {
        top: { itemId: 'starter.top.topless', color: '#bd3548' },
        bottom: { itemId: 'starter.bottom.punk', color: '#272e39' },
        footwear: { itemId: 'starter.footwear.punk', color: '#25232b' },
        instrument: { itemId: 'starter.instrument.standard', color: '#b97536' },
      },
    };
    const result = archivedPlayerModels(replayWithMember({
      profile_id: PROFILE_ID,
      display_name: 'Frozen Player',
      role: 'guitar',
      visual_snapshot: {
        appearance,
        legacyAvatar: null,
        richClothing: [],
        tattoos: [{ id: 'tattoo-1', profile_id: PROFILE_ID, body_slot: 'left_forearm', ink_color: '#1A2230', quality_score: 91, is_infected: false, category: 'musical' }],
      },
    }));
    expect(result?.appearances[PROFILE_ID]).toMatchObject(appearance);
    expect(result?.appearances[PROFILE_ID].body.muscle).toBe('bodybuilder');
    expect(result?.appearances[PROFILE_ID].equipment.top.itemId).toBe('starter.top.topless');
    expect(result?.appearances[PROFILE_ID].accessories).toEqual({ hat: 'none', hatColor: '#20232b', glasses: 'none', glassesColor: '#20232b' });
    expect(result?.richClothing[PROFILE_ID]).toEqual([]);
    expect(result?.tattoos?.[PROFILE_ID]).toEqual([{
      id: 'tattoo-1', profile_id: PROFILE_ID, body_slot: 'left_forearm', ink_color: '#1a2230', quality_score: 91, is_infected: false, category: 'musical',
    }]);
  });

  it('reconstructs a legacy avatar when no stage appearance existed at broadcast time', () => {
    const result = archivedPlayerModels(replayWithMember({
      profile_id: PROFILE_ID,
      display_name: 'Legacy Player',
      role: 'vocals',
      visual_snapshot: {
        appearance: null,
        legacyAvatar: { gender: 'female', skin_tone: '#d4a373', hair_color: '#54372a', height: 178, shirt_color: '#bd3548', pants_color: '#272e39', shoes_color: '#25232b' },
        richClothing: [],
      },
    }));
    expect(result?.appearances[PROFILE_ID].body.frame).toBe('feminine');
    expect(result?.appearances[PROFILE_ID].body.height).toBe(1);
    expect(result?.appearances[PROFILE_ID].equipment.top.color).toBe('#bd3548');
  });

  it('returns null for pre-v4 replays with no frozen visual snapshot', () => {
    const result = archivedPlayerModels(replayWithMember({ profile_id: PROFILE_ID, display_name: 'Old Replay', role: 'drums' }));
    expect(result).toBeNull();
  });
});
