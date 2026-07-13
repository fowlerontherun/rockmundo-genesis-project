import { useTranslation } from "@/hooks/useTranslation";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { PageEmptyState } from "@/components/ui/page-state";
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
  /** Optional KPIs. If omitted, the sidebar is hidden entirely (no more
   *  auto-generated "Tiles: 12 / Status: LIVE" filler). */
  stats?: HubStat[];
  featuredEyebrow?: string;
  featuredHeadline?: string;
  featuredCopy?: string;
  bare?: boolean;
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
  bare = false,
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

  const hasRealStats = stats && stats.length > 0;

  const content = (
    <>
      {allGroups.length === 0 && (
        <PageEmptyState
          title="Nothing is on the setlist yet"
          description="This hub is ready, but there are no destinations configured for it right now."
        />
      )}

      {featuredTile && (
        <div className={hasRealStats ? "grid gap-3 lg:grid-cols-[1fr_280px]" : ""}>
          <FeaturedTile
            tile={featuredTile}
            eyebrow={featuredEyebrow || "Featured"}
            headline={featuredHeadline}
            copy={featuredCopy}
          />
          {hasRealStats && <StatsSidebar stats={stats!} />}
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
    </>
  );

  if (bare) return content;

  return (
    <FMPageScaffold title={title} subtitle={description} eyebrow={featuredEyebrow}>
      {content}
    </FMPageScaffold>
  );
};

export default CategoryHub;
