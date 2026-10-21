import { describe, expect, it, vi } from "vitest";
import { freezeTotpCrowdCues } from "./freezeCrowdCues";
import type { TotpRenderItem } from "./renderSpec";
import type { CuratedCrowdAsset } from "@/features/shared-audio/crowdAudioCatalogue";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.example.test/crowd-sounds/${path}` } }) }) },
  },
}));

const asset = (id: string, category: CuratedCrowdAsset["category"], extra: Partial<CuratedCrowdAsset> = {}): CuratedCrowdAsset => ({
  id, name: id, storage_path: `${id}.mp3`, category,
  crowd_size: "medium", environments: ["studio"],
  intensity: 3, enabled: true, rights_confirmed: true, duration_seconds: 8,
  loopable: category === "ambient", gain_db: -12,
  fade_in_ms: 150, fade_out_ms: 250, cue_start_seconds: 0,
  cue_end_seconds: null, source_notes: null, ...extra,
});

const item = (index: number, kind: TotpRenderItem["kind"], start: number, duration: number): TotpRenderItem => ({
  index, kind, start_ms: start, duration_ms: duration,
  label: kind, performance_id: "performance-1", audio_url: null,
});

describe("TOTP frozen crowd cues", () => {
  const items = [
    item(0, "opening_titles", 0, 10_000),
    item(1, "presenter_link", 10_000, 7_000),
    item(2, "performance", 17_000, 60_000),
    item(3, "applause", 77_000, 4_000),
    item(4, "end_credits", 81_000, 8_000),
  ];

  it("freezes deterministic exact times, IDs and a single suitable ambience per programme item", () => {
    const library = [asset("studio-bed", "ambient"), asset("presenter-cheer", "cheer"), asset("applause", "applause"), asset("finale", "finale")];
    const first = freezeTotpCrowdCues(items, library, "episode-2002");
    const again = freezeTotpCrowdCues([...items], [...library].reverse(), "episode-2002");
    expect(first).toEqual(again);
    expect(first.filter((cue) => cue.item_index === 0 && cue.category === "ambient")).toHaveLength(1);
    expect(first.find((cue) => cue.category === "applause")).toEqual(expect.objectContaining({
      asset_id: "applause", at_ms: 77000, item_index: 3, duration_ms: 4000,
    }));
    expect(first.find((cue) => cue.category === "finale")?.at_ms).toBe(81000);
    expect(first.every((cue) => cue.audio_url.startsWith("https://storage.example.test/"))).toBe(true);
  });

  it("rejects disabled, unlicensed, wrong-size and wrong-environment clips", () => {
    const invalid = [
      asset("unlicensed", "applause", { rights_confirmed: false }),
      asset("disabled", "applause", { enabled: false }),
      asset("small", "applause", { crowd_size: "small" }),
      asset("pub", "applause", { environments: ["pub"] }),
    ];
    expect(freezeTotpCrowdCues([items[3]], invalid, "episode")).toEqual([]);
  });

  it("does not repeat the exact same reaction recording inside the cooldown", () => {
    const cues = freezeTotpCrowdCues(
      [item(1, "presenter_link", 1000, 4000), item(2, "performance", 5000, 4000)],
      [asset("cheer", "cheer")], "episode",
    );
    expect(cues.filter((cue) => cue.category === "cheer")).toHaveLength(1);
  });
});
