import type { LucideIcon } from "lucide-react";

export interface HubTile {
  icon: LucideIcon;
  labelKey: string;
  path: string;
  description?: string;
  imagePrompt?: string;
  tileImageKey?: string;
}

export interface TileGroup {
  label: string;
  tiles: HubTile[];
}

export interface HubStat {
  label: string;
  value: string | number;
  hint?: string;
}

export const tileKeyFor = (t: HubTile) =>
  t.tileImageKey || t.path.replace(/\//g, "-").replace(/^-/, "");
