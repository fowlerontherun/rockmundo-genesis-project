import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import type { LucideIcon } from "lucide-react";

interface HubTile {
  icon: LucideIcon;
  labelKey: string;
  path: string;
  description?: string;
  imageUrl?: string;
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

export const CategoryHub = ({ titleKey, description, tiles, groups }: CategoryHubProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const renderTileGrid = (tilesToRender: HubTile[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {tilesToRender.map((tile) => {
        const Icon = tile.icon;
        return (
          <Card
            key={tile.path}
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group overflow-hidden"
            onClick={() => navigate(tile.path)}
          >
            {tile.imageUrl ? (
              <>
                <AspectRatio ratio={16 / 9}>
                  <img
                    src={tile.imageUrl}
                    alt={t(tile.labelKey)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </AspectRatio>
                <CardContent className="p-3">
                  <span className="text-sm font-medium truncate block">{t(tile.labelKey)}</span>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex flex-col items-center justify-center text-center p-6 gap-3">
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <span className="text-sm font-medium line-clamp-2">{t(tile.labelKey)}</span>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );

  return (
    <PageLayout>
      <PageHeader title={t(titleKey)} subtitle={description} />

      {/* Ungrouped tiles (backwards compatible) */}
      {tiles && renderTileGrid(tiles)}

      {/* Grouped tiles with section headers */}
      {groups?.map((group) => (
        <div key={group.label} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </h2>
          {renderTileGrid(group.tiles)}
        </div>
      ))}
    </PageLayout>
  );
};
