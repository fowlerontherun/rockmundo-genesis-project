import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { TileImage } from "./TileImage";
import type { HubTile } from "./types";

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
    <button
      type="button"
      onClick={() => navigate(tile.path)}
      className="group relative aspect-square text-left overflow-hidden rounded-lg border border-fm-border bg-fm-panel rm-card-hover"
    >
      <TileImage
        tile={tile}
        className="opacity-80 group-hover:opacity-100 group-hover:scale-[1.04]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-fm-bg via-fm-bg/40 to-transparent" />

      {/* Accent stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-fm-accent" />

      {/* Icon chip */}
      <div className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-md border border-fm-border bg-fm-bg/70 backdrop-blur-sm">
        <Icon className="h-3.5 w-3.5 text-fm-accent" />
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 inset-x-0 p-3">
        <h3 className="font-display text-sm md:text-base text-fm-fg leading-tight tracking-tight font-medium">
          {label}
        </h3>
        {tile.description && (
          <p className="mt-0.5 text-[11px] text-fm-fg-muted/90 line-clamp-1 leading-snug">
            {tile.description}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-fm-accent opacity-0 group-hover:opacity-100 transition-opacity">
          Open <ArrowUpRight className="h-3 w-3" />
        </div>
      </div>
    </button>
  );
};
