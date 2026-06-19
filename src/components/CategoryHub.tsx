import { useTranslation } from "@/hooks/useTranslation";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import {
  FeaturedTile,
  SectionBand,
  StatsSidebar,
  TileGrid,
  type HubStat,
  type HubTile,
  type TileGroup,
} from "@/components/hub";

// Re-export for backward compatibility with existing imports.
export type { HubStat, HubTile, TileGroup } from "@/components/hub";

interface CategoryHubProps {
  titleKey: string;
  description?: string;
  tiles?: HubTile[];
  groups?: TileGroup[];
  /** Optional KPIs rendered in the magazine sidebar next to the hero tile. */
  stats?: HubStat[];
  /** Optional featured-tile metadata; defaults to the first tile in `tiles` or in the first group. */
  featuredEyebrow?: string;
  featuredHeadline?: string;
  featuredCopy?: string;
}

export const CategoryHub = ({
  titleKey,
  description,
  tiles,
  groups,
  stats,
  featuredEyebrow,
  featuredHeadline,
  featuredCopy,
}: CategoryHubProps) => {
  const { t } = useTranslation();
  const title = t(titleKey);

  const allGroups: TileGroup[] =
    groups && groups.length > 0
      ? groups
      : tiles && tiles.length > 0
        ? [{ label: "Categories", tiles }]
        : [];

  const featuredTile = allGroups[0]?.tiles[0];
  const firstGroupRest = allGroups[0]?.tiles.slice(1) ?? [];
  const restGroups = allGroups.slice(1);

  const totalTiles = allGroups.reduce((n, g) => n + g.tiles.length, 0);
  const topSection = allGroups.reduce<TileGroup | undefined>(
    (best, g) => (!best || g.tiles.length > best.tiles.length ? g : best),
    undefined,
  );
  const featuredLabel = featuredTile ? t(featuredTile.labelKey) : "—";
  const resolvedStats: HubStat[] =
    stats && stats.length > 0
      ? stats
      : [
          { label: "Tiles", value: totalTiles, hint: "Across this hub" },
          { label: "Sections", value: allGroups.length, hint: "Grouped categories" },
          { label: "Largest Section", value: topSection?.tiles.length ?? 0, hint: topSection?.label?.toUpperCase() },
          { label: "Featured", value: featuredLabel.toUpperCase(), hint: "Top of the page" },
          { label: "Status", value: "LIVE", hint: "Synced with your career" },
        ];

  return (
    <FMPageScaffold title={title} subtitle={description} eyebrow={featuredEyebrow}>
      {featuredTile && (
        <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <FeaturedTile
            tile={featuredTile}
            eyebrow={featuredEyebrow || "Featured"}
            headline={featuredHeadline}
            copy={featuredCopy}
          />
          <StatsSidebar stats={resolvedStats} />
        </div>
      )}

      {firstGroupRest.length > 0 && (
        <SectionBand label={allGroups[0].label} count={firstGroupRest.length}>
          <TileGrid tiles={firstGroupRest} />
        </SectionBand>
      )}

      {restGroups.map((group) => (
        <SectionBand key={group.label} label={group.label} count={group.tiles.length}>
          <TileGrid tiles={group.tiles} />
        </SectionBand>
      ))}
    </FMPageScaffold>
  );
};

export default CategoryHub;
