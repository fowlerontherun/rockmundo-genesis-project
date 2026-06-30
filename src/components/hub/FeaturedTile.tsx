import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Star } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { TileImage } from "./TileImage";
import type { HubTile } from "./types";

/**
 * Hero tile — large painterly art with a clean headline block.
 *
 * Previously layered tour-date stamps, spinning vinyls, halftone
 * screens, paper grain, and ticket tear strips. Stripped back to a
 * single accent stripe + headline so the hub reads cleanly.
 */
export const FeaturedTile = ({
  tile,
  eyebrow,
  headline,
  copy,
}: {
  tile: HubTile;
  eyebrow?: string;
  headline?: string;
  copy?: string;
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const label = t(tile.labelKey);

  return (
    <button
      type="button"
      onClick={() => navigate(tile.path)}
      className="group relative h-full w-full text-left overflow-hidden rounded-lg border border-fm-border bg-fm-panel aspect-[21/9] lg:aspect-auto lg:min-h-[240px] rm-card-hover"
    >
      <TileImage
        tile={tile}
        className="opacity-70 group-hover:opacity-95 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-fm-bg via-fm-bg/50 to-transparent" />
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-fm-accent" />

      <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
        <span className="inline-flex items-center gap-1 px-2 py-[3px] bg-fm-accent text-fm-bg font-medium text-[10px] tracking-tight mb-3 rounded-[3px]">
          <Star className="h-2.5 w-2.5 fill-current" /> {eyebrow || "Featured"}
        </span>
        <h2 className="font-display text-2xl md:text-4xl text-fm-fg leading-[0.95] tracking-tight mb-2 font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
          {headline || label}
        </h2>
        {(copy || tile.description) && (
          <p className="text-fm-fg-muted text-[12px] md:text-[13px] max-w-xl leading-snug">
            {copy || tile.description}
          </p>
        )}
        <div className="mt-3 inline-flex items-center gap-1 text-fm-accent text-[11px] tracking-tight font-medium">
          Open <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </button>
  );
};
