import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Star } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { TileImage } from "./TileImage";
import { Waveform } from "@/components/fm/motifs/Waveform";
import type { HubTile } from "./types";

/**
 * Magazine hero tile styled as a screen-printed concert poster.
 *
 *  - 21:9 painterly art layered with a halftone dot screen
 *    (`rm-halftone`) and a paper-grain overlay (`rm-poster`) to
 *    evoke gig-poster newsprint.
 *  - A vinyl disc spins in the top-right corner as a brand mark.
 *  - A stamped "NOW SHOWING" date block in the top-left mimics
 *    a tour-date plaque.
 *  - The bottom of the card carries a perforated ticket tear strip
 *    (`rm-tear`) below the headline so every hub hero reads as a
 *    ticket stub for that section.
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

  const today = new Date();
  const month = today.toLocaleString(undefined, { month: "short" }).toUpperCase();
  const day = today.getDate();

  return (
    <button
      type="button"
      onClick={() => navigate(tile.path)}
      className="group relative h-full w-full text-left overflow-hidden border border-fm-border bg-fm-panel rounded-lg aspect-[21/9] lg:aspect-auto lg:min-h-[260px] rm-card-hover"
    >
      {/* Painterly poster art */}
      <TileImage
        tile={tile}
        className="opacity-60 group-hover:opacity-85 group-hover:scale-[1.03]"
      />
      {/* Newsprint halftone + paper grain */}
      <div className="absolute inset-0 rm-halftone opacity-25 pointer-events-none" />
      <div className="absolute inset-0 rm-poster mix-blend-overlay opacity-75 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-fm-bg via-fm-bg/40 to-transparent" />

      {/* Module accent bar — left edge of poster */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-fm-accent" />

      {/* Tour-date stamp — top left */}
      <div className="absolute top-4 left-4 z-[2] flex flex-col items-center px-3 py-1.5 bg-fm-bg/85 border border-fm-accent rounded-sm shadow-lg backdrop-blur-sm">
        <span className="font-display text-[10px] tracking-tight text-fm-accent font-medium leading-none">
          {month}
        </span>
        <span className="font-display text-2xl tabular-nums text-fm-fg leading-none font-extrabold">
          {day}
        </span>
        <span className="text-[8px] tracking-tight text-fm-fg-muted leading-none mt-0.5">
          Now Showing
        </span>
      </div>

      {/* Spinning vinyl — top right brand mark */}
      <div className="absolute top-4 right-4 z-[2] opacity-85 group-hover:opacity-100 transition-opacity">
        <div className="rm-vinyl rm-vinyl-spin h-14 w-14" aria-hidden />
      </div>

      {/* Headline block — bottom of poster */}
      <div className="absolute bottom-0 left-0 right-0 z-[2] p-5 md:p-7">
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
        <div className="mt-3 flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-fm-accent text-[10px] tracking-tight font-medium">
            Open <ArrowUpRight className="h-3 w-3" />
          </span>
          <Waveform className="flex-1 opacity-70" height={14} />
        </div>
      </div>

      {/* Ticket-stub tear strip */}
      <div className="absolute bottom-0 inset-x-0 h-[10px] rm-tear z-[3] pointer-events-none" />
    </button>
  );
};
