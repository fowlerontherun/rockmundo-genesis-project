import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Star } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { TileImage } from "./TileImage";
import type { HubTile } from "./types";
import { Button } from '@/components/ui/button';

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
    <Button variant="ghost"
      type="button"
      onClick={() => navigate(tile.path)}
      className="group relative h-auto min-h-[250px] w-full whitespace-normal p-0 text-left overflow-hidden rounded-lg border border-fm-border bg-fm-panel lg:min-h-[270px] rm-card-hover"
    >
      <TileImage
        tile={tile}
        className="group-hover:scale-[1.03] motion-reduce:transition-none"
      />
      <div className="absolute inset-0 rm-featured-shade" />
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-fm-accent" />

      <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
        <span className="inline-flex items-center gap-1 px-2 py-[3px] bg-fm-accent text-fm-bg font-medium text-[10px] tracking-tight mb-3 rounded-[3px]">
          <Star className="h-2.5 w-2.5 fill-current" /> {eyebrow || "Featured"}
        </span>
        <h2 className="font-display text-2xl md:text-3xl text-fm-fg leading-tight tracking-normal mb-2 font-semibold">
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
    </Button>
  );
};
