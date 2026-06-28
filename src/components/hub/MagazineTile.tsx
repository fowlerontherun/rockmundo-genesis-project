import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { TileImage } from "./TileImage";
import { Waveform } from "@/components/fm/motifs/Waveform";
import type { HubTile } from "./types";

/**
 * Magazine tile — square card with painterly art. The bottom strip
 * gets a thin waveform underline that tints to the active module
 * accent so every hub immediately reads as a music interface.
 */
export const MagazineTile = ({ tile }: { tile: HubTile }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const label = t(tile.labelKey);
  return (
    <button
      type="button"
      onClick={() => navigate(tile.path)}
      className="group relative aspect-square overflow-hidden border border-fm-border bg-fm-panel rounded-lg text-left rm-card-hover"
    >
      <TileImage tile={tile} className="opacity-80 group-hover:opacity-100 group-hover:scale-[1.04]" />
      <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors" />
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/95 via-black/65 to-transparent">
        <Waveform className="mb-2 opacity-80" height={10} />
        <h3 className="font-display text-[13px] md:text-sm text-fm-fg tracking-tight leading-tight font-bold">
          {label}
        </h3>
        {tile.description && (
          <p className="mt-0.5 text-[10.5px] text-fm-fg-muted/90 line-clamp-1 leading-snug">
            {tile.description}
          </p>
        )}
      </div>
    </button>
  );
};
