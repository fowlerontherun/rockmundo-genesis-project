import type { FestivalPublicConfirmedAct, FestivalPublicEdition, FestivalPublicStage } from "./festivalLaunch";

type BrandFields = Pick<FestivalPublicEdition, "id" | "festivalType" | "vibe" | "scale">;

const PALETTES = [
  { dark: "#0f172a", mid: "#4338ca", light: "#f0abfc", accent: "#fde68a" },
  { dark: "#132519", mid: "#166534", light: "#86efac", accent: "#fef08a" },
  { dark: "#311123", mid: "#be185d", light: "#f9a8d4", accent: "#67e8f9" },
  { dark: "#1f1d38", mid: "#7c3aed", light: "#c4b5fd", accent: "#fdba74" },
  { dark: "#272013", mid: "#b45309", light: "#fde68a", accent: "#bef264" },
  { dark: "#082f49", mid: "#0369a1", light: "#7dd3fc", accent: "#fda4af" },
] as const;

/** Stable, display-only theme. A change of edition or published identity can change artwork,
 * but no random render-time decisions or client-authoritative festival facts are involved. */
export function festivalVisualIdentity(fields: BrandFields) {
  const seed = [fields.id, fields.festivalType, fields.vibe, fields.scale].filter(Boolean).join("|");
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return {
    palette: PALETTES[hash % PALETTES.length],
    motif: hash % 3,
    typeLabel: fields.festivalType?.trim() || "Music festival",
    vibeLabel: fields.vibe?.trim() || null,
    scaleLabel: fields.scale?.trim() || null,
  };
}

/** Visual scale follows *published stage capacity*, not guessed upgrades or crowd counts. */
export function stageVisualScale(stage: FestivalPublicStage) {
  if (stage.capacity === 0) return { label: "Stage scale unavailable", lights: 2, height: 64 };
  if (stage.capacity >= 5000) return { label: "Large-format stage", lights: 7, height: 112 };
  if (stage.capacity >= 1000) return { label: "Festival stage", lights: 5, height: 96 };
  if (stage.capacity >= 250) return { label: "Mid-size stage", lights: 4, height: 80 };
  return { label: "Intimate stage", lights: 2, height: 64 };
}

export function stagePublishedHeadliners(
  stageName: string,
  lineup: readonly FestivalPublicConfirmedAct[],
) {
  return lineup.filter((act) => act.stageName === stageName && act.billingPosition === "headliner");
}
