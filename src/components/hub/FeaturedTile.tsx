import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Disc3 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { TileImage } from "./TileImage";
import { Waveform } from "@/components/fm/motifs/Waveform";
import type { HubTile } from "./types";

/**
 * Magazine hero tile — wide 21:9 banner with painterly art, a vinyl
 * disc decoration in the corner and a concert-poster waveform strip
 * along the bottom edge to give RockMundo hubs a recognisable music
 * identity rather than a generic management-sim look.
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
      className="group relative h-full w-full text-left overflow-hidden border border-fm-border bg-fm-panel rounded-lg aspect-[21/9] lg:aspect-auto lg:min-h-[260px] rm-card-hover"
    >
      <TileImage tile={tile} className="opacity-55 group-hover:opacity-80 group-hover:scale-[1.03]" />
      <div className="absolute inset-0 rm-poster mix-blend-overlay opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-t from-fm-bg via-fm-bg/40 to-transparent" />
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-fm-accent" />

      {/* Vinyl decoration — top right */}
      <div className="absolute top-4 right-4 opacity-80 group-hover:opacity-100 transition-opacity">
        <div className="relative">
          <div className="rm-vinyl rm-vinyl-spin h-14 w-14" aria-hidden />
          <Disc3 className="absolute inset-0 m-auto h-4 w-4 text-fm-accent opacity-0" aria-hidden />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
        <span className="inline-block px-2 py-[3px] bg-fm-accent text-fm-bg font-bold text-[10px] uppercase tracking-[0.18em] mb-3 rounded-[3px]">
          {eyebrow || "Featured"}
        </span>
        <h2 className="font-display text-2xl md:text-3xl text-fm-fg leading-tight tracking-tight mb-1.5 font-extrabold">
          {headline || label}
        </h2>
        {(copy || tile.description) && (
          <p className="text-fm-fg-muted text-[12px] md:text-[13px] max-w-xl leading-snug">
            {copy || tile.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-fm-accent text-[10px] uppercase tracking-[0.18em] font-bold">
            Open <ArrowUpRight className="h-3 w-3" />
          </span>
          <Waveform className="flex-1 opacity-60" height={14} />
        </div>
      </div>
    </button>
  );
};
