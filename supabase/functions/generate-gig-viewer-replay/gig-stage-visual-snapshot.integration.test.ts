import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../../..");
const read = (name: string) => readFileSync(path.join(root, name), "utf8");
const migration = read("supabase/migrations/20261016111000_gig_immutable_stage_costume_snapshots.sql");
const generation = read("supabase/functions/generate-gig-viewer-replay/index.ts");
const loader = read("src/features/gig-experience/services/GigViewerReplayService.ts");
const stage = read("src/features/gig-experience/viewer/three/GigStage3D.tsx");

describe("historical Halloween costume release contract", () => {
  it("captures costume at authoritative gig start, not replay-generation time", () => {
    expect(migration).toContain("AFTER UPDATE OF status,started_at ON public.gigs");
    expect(migration).toContain("NEW.status NOT IN ('in_progress','live')");
    expect(migration).toContain("public.player_stage_appearances");
    expect(migration).toContain("public.player_owned_skins pos");
    expect(migration).toContain("pos.is_equipped IS TRUE");
    expect(migration).toContain("ON CONFLICT (gig_id,profile_id) DO NOTHING");
    expect(migration).toContain("BEFORE UPDATE ON public.gig_stage_visual_snapshots");
    expect(migration).toContain("ON DELETE CASCADE");
    expect(migration).not.toContain("BEFORE UPDATE OR DELETE ON public.gig_stage_visual_snapshots");
  });

  it("enforces private service-only replay snapshots and keeps personal metadata out", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON public.gig_stage_visual_snapshots FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT SELECT, INSERT ON public.gig_stage_visual_snapshots TO service_role");
    expect(migration).toContain("'gender', pac.gender");
    expect(migration).not.toContain("'legacy', to_jsonb(pac)");
  });

  it("saves an actual immutable payload and lets older replays omit it", () => {
    expect(generation).toContain('.from("gig_stage_visual_snapshots")');
    expect(generation).toContain("playerVisualsSnapshot,");
    expect(loader).toContain("resolveStoredGigStageVisuals(payload?.playerVisualsSnapshot)");
    expect(stage).toContain("playerModelsSnapshot ?? replay.playerModelsSnapshot ?? null");
    expect(stage).toContain("useGigPlayerModels(frozenPlayerModels ? [] :");
    expect(stage).toContain("const resolvedPlayerModels = frozenPlayerModels ?? livePlayerModels.data ?? null");
  });
});
