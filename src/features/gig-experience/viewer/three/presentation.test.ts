import { describe, expect, it } from 'vitest';
import { buildStagePlan, concertFrame, concertOptions } from './presentation';
import { derivePlaybackState } from '../engine/PlaybackController';
import { DEFAULT_CROWD_TUNING } from '../engine/CrowdTuning';
import { defaultAppearance } from '@/features/player-model/appearance';
import type { ClothingItem } from '@/hooks/useSkinStore';
import type { GigExperienceDTO } from '../../types';
import { makeStageReplay, performerId } from './test-fixtures';

describe('canonical replay to 3D stage', () => {
  it('uses the recorded lineup and saved appearances without inventing the demo band', async () => {
    const replay = await makeStageReplay(['Vocals', 'Keyboard', 'DJ', 'Violin', 'Trumpet', 'Percussion', 'Bass', 'Drums']);
    const experience = { gig: { venue: { capacity: 200, name: 'Actual theatre' } }, performers: [{ id: 'absent', profileId: 'absent', displayName: 'Absent member', roleOrInstrument: 'Guitar', lineupStatus: 'declined' }] } as GigExperienceDTO;
    const plan = buildStagePlan(replay, experience), appearance = defaultAppearance(); appearance.body.frame = 'feminine';
    const options = concertOptions(plan, { [performerId(0)]: appearance }, replay, experience, 'theatre');
    expect(options.externalClock).toBe(true); expect(options.performers).toHaveLength(8); expect(options.performers.map(p => p.role)).toEqual(['vocals', 'keyboard', 'dj', 'strings', 'brass', 'percussion', 'bass', 'drums']);
    expect(options.performers[0].appearance).toEqual(appearance); expect(options.venue).toMatchObject({ name: 'Actual theatre', archetype: 'theatre' });
    expect(options.performers.some(p => p.id === 'absent')).toBe(false);
    const empty = await makeStageReplay([]); expect(concertOptions(buildStagePlan(empty, null), {}, empty, null, 'pub').performers).toEqual([]);
  });

  it('propagates equipped rich clothing to the matching performer only', async () => {
    const replay = await makeStageReplay(['Vocals', 'Guitar']);
    const plan = buildStagePlan(replay, null);
    const clothing = {
      id: 'item-1', name: 'Stage Jacket', category: 'jacket', wearable_slot: 'outerwear', color_variants: [],
    } as ClothingItem;
    const rich = { [performerId(0)]: [{ item: clothing, variant: { id: 'black', label: 'Black', color: '#111111' } }] };
    const options = concertOptions(plan, {}, replay, null, 'club', rich);
    expect(options.performers[0].richClothing).toEqual(rich[performerId(0)]);
    expect(options.performers[1].richClothing).toEqual([]);
  });

  it('reconstructs entrances, stationary instruments, backwards seeks and exits from the replay clock', async () => {
    const replay = await makeStageReplay(), plan = buildStagePlan(replay, null);
    const frame = (time: number, reduced = false) => concertFrame(plan, replay, null, derivePlaybackState(replay, time), reduced, DEFAULT_CROWD_TUNING);
    expect(frame(0).performers.every(p => !p.visible)).toBe(true);
    const entry = replay.events.find(e => e.visualPayload.type === 'performer_enter')!;
    expect(frame(entry.scheduledOffsetMs + 500).performers[0]).toMatchObject({ visible: true, walking: true });
    const song = replay.events.find(e => e.phase === 'song_performance')!;
    const earlier = frame(song.scheduledOffsetMs + 100); const later = frame(song.scheduledOffsetMs + 1000);
    expect(earlier.performers[3].position).toEqual(later.performers[3].position);
    expect(earlier.performers[1].position).not.toEqual(later.performers[1].position);
    frame(replay.durationMs); expect(frame(song.scheduledOffsetMs + 100)).toEqual(earlier);
    expect(frame(replay.durationMs).performers.every(p => !p.visible)).toBe(true);
    expect(frame(song.scheduledOffsetMs + 100, true).performers).toEqual(frame(song.scheduledOffsetMs + 1000, true).performers);
  });
  it('keeps an authoritative empty venue empty and animates actual crowd arrival', async () => {
    const empty = await makeStageReplay(undefined, 0), plan = buildStagePlan(empty, null);
    for (const time of [0, 30_000, 60_000]) expect(concertFrame(plan, empty, null, derivePlaybackState(empty, time), false, DEFAULT_CROWD_TUNING).crowd).toBe(0);
    const replay = await makeStageReplay(), fill = replay.events.find(e => e.visualPayload.type === 'crowd_fill')!;
    const density = (time: number) => concertFrame(buildStagePlan(replay, null), replay, null, derivePlaybackState(replay, time), false, DEFAULT_CROWD_TUNING).crowd;
    expect(density(fill.scheduledOffsetMs)).toBe(0); expect(density(fill.scheduledOffsetMs + fill.durationMs / 2)).toBeGreaterThan(0); expect(density(fill.scheduledOffsetMs + fill.durationMs)).toBeGreaterThan(density(fill.scheduledOffsetMs + fill.durationMs / 2));
  });
  it('keeps initial and replay positions aligned on capacity-scaled stages and binds distant occupancy to attendance', async () => {
    const replay = await makeStageReplay(undefined, 40);
    const song = replay.events.find(e => e.phase === 'song_performance')!;
    for (const capacity of [70, 2000, 65000]) {
      const experience = { gig: { venue: { capacity, type: 'concert_hall', id: 'same-venue', name: 'Actual Hall' } }, headline: { attendance: { status: 'available', value: 40 } } } as GigExperienceDTO;
      const plan = buildStagePlan(replay, experience), options = concertOptions(plan, {}, replay, experience, 'theatre');
      const state = concertFrame(plan, replay, experience, derivePlaybackState(replay, song.scheduledOffsetMs + 100), false, DEFAULT_CROWD_TUNING, options.venue);
      expect(state.performers[3].position).toEqual(options.performers[3].position);
      expect(state.occupancy).toBeCloseTo(40 / capacity);
      expect(options.venue).toMatchObject({ type: 'concert_hall', capacity });
    }
  });

});

it('keeps recorded instruments and vocal duties when current profile roles differ',async()=>{
  const replay=await makeStageReplay(['Acoustic Guitar / Backup Singer','Harp','Flute','Rapping']);
  const experience={gig:{venue:{capacity:700}},headline:{},performers:[{id:performerId(0),profileId:performerId(0),displayName:'Current member',roleOrInstrument:'Drums',lineupStatus:'performed'}]} as GigExperienceDTO;
  const plan=buildStagePlan(replay,experience),options=concertOptions(plan,{},replay,experience,'club');
  expect(options.performers[0]).toMatchObject({instrument:'acoustic_guitar',vocal:'backing',role:'guitar'});
  expect(options.performers[1]).toMatchObject({instrument:'harp',role:'strings'});expect(options.performers[2]).toMatchObject({instrument:'flute',role:'woodwind'});expect(options.performers[3]).toMatchObject({instrument:'rapping',role:'vocals'});
  const time=replay.events.find(e=>e.phase==='song_performance')!.scheduledOffsetMs;
  const frame=(t:number)=>concertFrame(plan,replay,experience,derivePlaybackState(replay,t),false,DEFAULT_CROWD_TUNING);
  expect(frame(time+100).performers[1].position).toEqual(frame(time+900).performers[1].position);
});
