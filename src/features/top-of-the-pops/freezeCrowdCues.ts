import type { TotpManifestCrowdCue } from "./episodeManifest";
import type { TotpRenderItem } from "./renderSpec";
import { selectCrowdCue, type CrowdCategory } from "@/features/gig-experience/audio/crowdCueSelection";
import type { CuratedCrowdAsset } from "@/features/shared-audio/crowdAudioCatalogue";
import { curatedAssetAsClip } from "@/features/shared-audio/crowdAudioCatalogue";

/**
 * Convert immutable render positions into immutable curated crowd choices.
 * The manifest checksum covers each selected asset ID, URL and absolute time.
 * If no rights-cleared asset matches, omit that cue rather than auto-authorize it.
 */
export function freezeTotpCrowdCues(
  items: readonly TotpRenderItem[],
  assets: readonly CuratedCrowdAsset[],
  episodeSeed: string,
): TotpManifestCrowdCue[] {
  const history: Array<{ assetId: string; atSeconds: number }> = [];
  const cues: TotpManifestCrowdCue[] = [];
  const pick = (item: TotpRenderItem, category: CrowdCategory, offsetMs = 0, bed = false) => {
    const atMs = item.start_ms + offsetMs;
    const atSeconds = atMs / 1000;
    const selected = selectCrowdCue(assets, {
      category, crowdSize: "medium", environment: "studio", intensity: 3,
      seed: `${episodeSeed}:item:${item.index}:${category}:${offsetMs}`,
      atSeconds, history, cooldownSeconds: bed ? 0 : 12,
    }) as CuratedCrowdAsset | null;
    if (!selected) return;
    const clip = curatedAssetAsClip(selected);
    const sourceDuration = Math.max(0, (selected.cue_end_seconds ?? selected.duration_seconds ?? 0) - selected.cue_start_seconds);
    const remaining = Math.max(0, item.duration_ms - offsetMs);
    const ms = bed ? remaining : sourceDuration > 0 ? Math.min(remaining, Math.round(sourceDuration * 1000)) : Math.min(remaining, 2500);
    if (!ms) return;
    cues.push({
      cue_id: `crowd:${item.index}:${category}:${offsetMs}`,
      item_index: item.index,
      at_ms: atMs,
      category,
      asset_id: selected.id,
      audio_url: clip.url,
      duration_ms: ms,
      loopable: bed && selected.loopable,
      gain_db: selected.gain_db,
      cue_start_seconds: selected.cue_start_seconds,
      cue_end_seconds: selected.cue_end_seconds,
    });
    history.push({ assetId: selected.id, atSeconds });
  };
  for (const item of items) {
    if (["opening_titles", "programme_continuity", "presenter_link", "studio_transition", "performance", "chart_rundown", "end_credits"].includes(item.kind)) {
      pick(item, "ambient", 0, true);
    }
    if (item.kind === "presenter_link") pick(item, "cheer");
    if (item.kind === "performance") pick(item, "cheer");
    if (item.kind === "applause") pick(item, "applause");
    if (item.kind === "chart_rundown") pick(item, "reaction");
    if (item.kind === "end_credits") pick(item, "finale");
  }
  return cues.sort((a, b) => a.at_ms - b.at_ms || a.cue_id.localeCompare(b.cue_id));
}
