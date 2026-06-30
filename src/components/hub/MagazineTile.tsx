import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { TileImage } from "./TileImage";
import { Waveform } from "@/components/fm/motifs/Waveform";
import type { HubTile } from "./types";

/**
 * Magazine tile styled as a 12" album sleeve.
 *
 *  - Painterly tile art sits inside a cardboard sleeve frame
 *    (`rm-sleeve`) with a spine shadow on the left edge.
 *  - A vinyl disc (`rm-vinyl`) peeks from behind the artwork and
 *    slides out on hover (`rm-vinyl-peek`).
 *  - A round catalog sticker (`rm-sticker`) in the module accent
 *    colour carries an auto-generated catalog number per tile so the
 *    grid reads like a record store rack.
 *  - A waveform strip + album-style title block sit at the bottom.
 */
export const MagazineTile = ({ tile }: { tile: HubTile }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const label = t(tile.labelKey);

  // Deterministic faux catalog number per tile path.
  const catNo = useMemo(() => {
    let h = 0;
    for (const ch of tile.path) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const n = (h % 900) + 100;
    return `RM-${n}`;
  }, [tile.path]);

  return (
    <button
      type="button"
      onClick={() => navigate(tile.path)}
      className="group relative aspect-square text-left rm-card-hover"
    >
      {/* Vinyl disc peeking from behind the sleeve */}
      <div
        aria-hidden
        className="rm-vinyl rm-vinyl-peek absolute top-1/2 right-0 -translate-y-1/2 aspect-square h-[92%] pointer-events-none z-0"
      />

      {/* Album sleeve */}
      <div className="rm-sleeve absolute inset-0 z-[1] overflow-hidden border border-fm-border bg-fm-panel rounded-md">
        <TileImage
          tile={tile}
          className="opacity-90 group-hover:opacity-100 group-hover:scale-[1.04]"
        />
        {/* paper grain overlay */}
        <div className="absolute inset-0 rm-poster opacity-50 mix-blend-overlay pointer-events-none" />
        <div className="absolute inset-0 bg-black/15 group-hover:bg-black/5 transition-colors" />

        {/* Catalog sticker */}
        <span
          className="rm-sticker absolute top-2 left-2 z-[2] px-2 py-0.5 text-[9px] tabular-nums"
          aria-hidden
        >
          {catNo}
        </span>

        {/* Title block — album cover lower band */}
        <div className="absolute bottom-0 inset-x-0 z-[2] p-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
          <Waveform className="mb-2 opacity-80" height={10} />
          <div className="border-l-2 border-fm-accent pl-2">
            <h3 className="font-display text-[13px] md:text-sm text-fm-fg tracking-tight leading-tight font-medium ">
              {label}
            </h3>
            {tile.description && (
              <p className="mt-0.5 text-[10.5px] text-fm-fg-muted/90 line-clamp-1 leading-snug">
                {tile.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};
