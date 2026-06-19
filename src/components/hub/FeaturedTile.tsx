import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { TileImage } from "./TileImage";
import type { HubTile } from "./types";

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
      className="group relative h-full w-full text-left overflow-hidden border border-fm-border bg-fm-panel rounded-sm aspect-[21/9] lg:aspect-auto lg:min-h-[260px]"
    >
      <TileImage tile={tile} className="opacity-60 group-hover:opacity-80 group-hover:scale-[1.03]" />
      <div className="absolute inset-0 bg-gradient-to-t from-fm-bg via-fm-bg/40 to-transparent" />
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-fm-accent" />
      <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
        <span className="inline-block px-2 py-[3px] bg-fm-accent text-fm-bg font-bold text-[10px] uppercase tracking-[0.16em] mb-3 rounded-[2px]">
          {eyebrow || "Featured"}
        </span>
        <h2 className="font-bebas text-3xl md:text-4xl text-fm-fg leading-none tracking-wide uppercase mb-2">
          {headline || label}
        </h2>
        {(copy || tile.description) && (
          <p className="text-fm-fg-muted text-[12px] md:text-xs max-w-xl uppercase tracking-[0.14em] font-light">
            {copy || tile.description}
          </p>
        )}
        <span className="mt-3 inline-flex items-center gap-1 text-fm-accent text-[10px] uppercase tracking-[0.18em] font-semibold opacity-80 group-hover:opacity-100">
          Open <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
};
