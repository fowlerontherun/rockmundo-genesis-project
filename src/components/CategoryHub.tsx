import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { FMSection } from "@/components/fm/FMSection";
import { Skeleton } from "@/components/ui/skeleton";
import { useHubTileImage } from "@/hooks/useHubTileImage";
import { cn } from "@/lib/utils";
import { ChevronRight, type LucideIcon } from "lucide-react";

interface HubTile {
  icon: LucideIcon;
  labelKey: string;
  path: string;
  description?: string;
  imagePrompt?: string;
  tileImageKey?: string;
}

interface TileGroup {
  label: string;
  tiles: HubTile[];
}

interface CategoryHubProps {
  titleKey: string;
  description?: string;
  tiles?: HubTile[];
  groups?: TileGroup[];
}

/** FM-style dense tile: 56px thumbnail, label, optional 1-line description. */
const HubTileCard = ({ tile }: { tile: HubTile }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const Icon = tile.icon;

  const tileKey = tile.tileImageKey || tile.path.replace(/\//g, "-").replace(/^-/, "");
  const { data: imageUrl, isLoading } = useHubTileImage(
    tileKey,
    tile.imagePrompt || t(tile.labelKey),
  );

  const label = t(tile.labelKey);

  return (
    <button
      type="button"
      onClick={() => navigate(tile.path)}
      className={cn(
        "group flex items-center gap-3 p-2 bg-fm-panel border border-fm-border rounded-sm",
        "hover:border-fm-accent hover:bg-fm-panel-2 transition-colors text-left w-full",
      )}
    >
      <div className="relative h-14 w-14 flex-shrink-0 bg-fm-panel-2 border border-fm-border rounded-sm overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={label}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : isLoading ? (
          <Skeleton className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="h-6 w-6 text-fm-accent" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-fm-fg uppercase tracking-wide truncate">
          {label}
        </div>
        {tile.description && (
          <div className="text-[11px] text-fm-fg-muted truncate">{tile.description}</div>
        )}
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-fm-fg-muted group-hover:text-fm-accent flex-shrink-0" />
    </button>
  );
};

const TileGrid = ({ tiles }: { tiles: HubTile[] }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
    {tiles.map((tile) => (
      <HubTileCard key={tile.path} tile={tile} />
    ))}
  </div>
);

export const CategoryHub = ({ titleKey, description, tiles, groups }: CategoryHubProps) => {
  const { t } = useTranslation();
  const title = t(titleKey);

  return (
    <FMPageScaffold title={title} subtitle={description}>
      {tiles && tiles.length > 0 && (
        <FMSection title="Categories">
          <TileGrid tiles={tiles} />
        </FMSection>
      )}

      {groups?.map((group) => (
        <FMSection key={group.label} title={group.label}>
          <TileGrid tiles={group.tiles} />
        </FMSection>
      ))}
    </FMPageScaffold>
  );
};

export default CategoryHub;
