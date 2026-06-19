import { Skeleton } from "@/components/ui/skeleton";
import { useHubTileImage } from "@/hooks/useHubTileImage";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { tileKeyFor, type HubTile } from "./types";

export const TileImage = ({
  tile,
  className,
}: {
  tile: HubTile;
  className?: string;
}) => {
  const { t } = useTranslation();
  const { data: imageUrl, isLoading } = useHubTileImage(
    tileKeyFor(tile),
    tile.imagePrompt || t(tile.labelKey),
  );
  const Icon = tile.icon;
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-transform duration-700",
          className,
        )}
      />
    );
  }
  if (isLoading) return <Skeleton className={cn("absolute inset-0", className)} />;
  return (
    <div className={cn("absolute inset-0 grid place-items-center bg-fm-panel-2", className)}>
      <Icon className="h-10 w-10 text-fm-accent/70" />
    </div>
  );
};
