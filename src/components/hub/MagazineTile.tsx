import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { TileImage } from "./TileImage";
import type { HubTile } from "./types";

export const MagazineTile = ({ tile }: { tile: HubTile }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const label = t(tile.labelKey);
  return (
    <button
      type="button"
      onClick={() => navigate(tile.path)}
      className="group relative aspect-square overflow-hidden border border-fm-border hover:border-fm-accent bg-fm-panel rounded-sm text-left transition-colors"
    >
      <TileImage tile={tile} className="opacity-80 group-hover:opacity-100 group-hover:scale-[1.04]" />
      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors" />
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        <div className="h-[2px] w-full bg-fm-accent mb-2" />
        <h3 className="font-bebas text-base md:text-lg text-fm-fg tracking-wide uppercase leading-none">
          {label}
        </h3>
        {tile.description && (
          <p className="mt-1 text-[10px] text-fm-fg-muted/90 line-clamp-1 uppercase tracking-wide">
            {tile.description}
          </p>
        )}
      </div>
    </button>
  );
};
