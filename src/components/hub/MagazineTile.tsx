import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { TileImage } from "./TileImage";
import type { HubTile } from "./types";
import { Button } from '@/components/ui/button';

/**
 * Hub tile — clean, dense card.
 *
 *  - Square painterly art with a soft bottom gradient.
 *  - Module accent stripe down the left edge.
 *  - Single title + optional one-line description in the footer.
 *
 * Previously layered halftones, vinyl peeks, catalog stickers and
 * waveforms on every tile, which made grids look noisy. Removed in
 * favour of a quieter, more readable card.
 */
export const MagazineTile = ({ tile }: { tile: HubTile }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const label = t(tile.labelKey);
  const Icon = tile.icon;

  return (
    <Button variant="ghost"
      type="button"
      onClick={() => navigate(tile.path)}
      className="group relative flex h-auto w-full flex-col items-stretch whitespace-normal p-0 text-left overflow-hidden rounded-lg border border-fm-border bg-fm-panel rm-card-hover"
    >
      <div className="relative w-full aspect-[4/3] overflow-hidden">
      <TileImage
        tile={tile}
        className="group-hover:scale-[1.04] motion-reduce:transition-none"
      />
      </div>

      {/* Accent stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-fm-accent" />

      {/* Icon chip */}
      <div className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-md border border-fm-border bg-fm-bg/70 backdrop-blur-sm">
        <Icon className="h-3.5 w-3.5 text-fm-accent" />
      </div>

      {/* Footer */}
      <div className="relative flex-1 border-t border-fm-border p-2.5 pr-7">
        <h3 className="font-display text-sm md:text-base text-fm-fg leading-tight tracking-tight font-medium">
          {label}
        </h3>
        {tile.description && (
          <p className="mt-0.5 text-[11px] text-fm-fg-muted/90 line-clamp-1 leading-snug">
            {tile.description}
          </p>
        )}
        <div className="absolute right-2.5 top-3 text-fm-accent">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </Button>
  );
};
