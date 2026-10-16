// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// The crafted instrument request must remain independent of Avatar V1's base
// appearance, Pumpkin Hat and rich clothing. Other stage RPCs should still
// fail visibly when mandatory data is missing.
const source = readFileSync('src/features/player-model/usePlayerModel.ts', 'utf8');

it('retries transient personal crafted-instrument lookups without retrying invalid sessions', () => {
  expect(source).toContain("callStageRpc('get_equipped_stage_luthiery_instruments'");
  expect(source).toContain('retry: (failures, error: Error) =>');
  expect(source).toContain('failures < 2');
  expect(source).toContain('authentication_required|permission denied|jwt|unauthoriz');
  expect(source).toContain('refetchOnWindowFocus: true');
});

it('keeps gig avatar and equipped Pumpkin Hat visuals available if only optional luthiery RPC rejects', () => {
  expect(source).toContain("optionalStageResult('equipped rich clothing', clothingSettled)");
  expect(source).toContain("optionalStageResult('player-crafted instruments', luthierySettled)");
  expect(source).toContain('let luthieryResult: StageRpcResult = { data: [], error: null };');
  expect(source).toContain("console.warn('[gig-player-models] continuing without optional crafted-instrument visuals', error)");
  expect(source).toContain('return { appearances, richClothing, tattoos, instrumentSkins, merchWearables, luthieryInstruments }');
});
