import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Skeleton } from "@/components/ui/skeleton";
import { useHubTileImage } from "@/hooks/useHubTileImage";
import { cn } from "@/lib/utils";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

interface HubTile {
  icon: LucideIcon;
  labelKey: string;
  path: string;
  description?: string;
  imagePrompt?: string;
  tileImageKey?: string;
}

interface TileGroup {
  label: string;
  tiles: HubTile[];
}

export interface HubStat {
  label: string;
  value: string | number;
  hint?: string;
}

interface CategoryHubProps {
  titleKey: string;
  description?: string;
  tiles?: HubTile[];
  groups?: TileGroup[];
  /** Optional KPIs rendered in the magazine sidebar next to the hero tile. */
  stats?: HubStat[];
  /** Optional featured-tile metadata; defaults to the first tile in `tiles` or in the first group. */
  featuredEyebrow?: string;
  featuredHeadline?: string;
  featuredCopy?: string;
}

const tileKeyFor = (t: HubTile) =>
  t.tileImageKey || t.path.replace(/\//g, "-").replace(/^-/, "");

/* ---------- Painterly tile thumbnail with skeleton/icon fallback ---------- */
const TileImage = ({
  tile,
  className,
}: {
  tile: HubTile;
  className?: string;
}) => {
  const { t } = useTranslation();
  const { data: imageUrl, isLoading } = useHubTileImage(
    tileKeyFor(tile),
    tile.imagePrompt || t(tile.labelKey),
  );
  const Icon = tile.icon;
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-transform duration-700",
          className,
        )}
      />
    );
  }
  if (isLoading) return <Skeleton className={cn("absolute inset-0", className)} />;
  return (
    <div className={cn("absolute inset-0 grid place-items-center bg-fm-panel-2", className)}>
      <Icon className="h-10 w-10 text-fm-accent/70" />
    </div>
  );
};

/* ---------- Featured hero tile ---------- */
const FeaturedTile = ({
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
      {/* Dark bottom-up gradient to ground the text */}
      <div className="absolute inset-0 bg-gradient-to-t from-fm-bg via-fm-bg/40 to-transparent" />
      {/* Module accent left bar */}
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

/* ---------- Stats sidebar matching hero height ---------- */
const StatsSidebar = ({ stats }: { stats: HubStat[] }) => (
  <aside className="hidden lg:flex flex-col border border-fm-border bg-fm-panel-2 p-4 rounded-sm">
    <span className="text-fm-accent text-[10px] uppercase font-bold tracking-[0.18em] mb-3">
      Trending Data
    </span>
    <div className="flex-1 flex flex-col divide-y divide-fm-border">
      {stats.map((s, i) => (
        <div key={i} className={cn("py-2.5", i === 0 && "pt-0")}>
          <div className="text-xl font-bold tabular-nums text-fm-fg leading-none">
            {s.value}
          </div>
          <div className="mt-1 text-[10px] text-fm-fg-muted uppercase tracking-wider">
            {s.label}
          </div>
          {s.hint && (
            <div className="mt-0.5 text-[10px] text-fm-fg-muted/70">{s.hint}</div>
          )}
        </div>
      ))}
    </div>
  </aside>
);

/* ---------- Painterly square tile in the sub-grid ---------- */
const MagazineTile = ({ tile }: { tile: HubTile }) => {
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

/* ---------- Section band ---------- */
const SectionBand = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3">
    <header className="relative flex items-end justify-between border-b border-fm-border pb-2">
      <div className="flex items-center gap-2">
        <span className="w-1 h-5 bg-fm-accent" />
        <h3 className="font-bebas text-xl md:text-2xl tracking-wide uppercase text-fm-fg leading-none">
          {label}
        </h3>
      </div>
      <span className="text-[10px] text-fm-fg-muted uppercase tracking-[0.18em] tabular-nums">
        {Array.isArray((children as any)?.props?.tiles)
          ? `${(children as any).props.tiles.length} ITEMS`
          : ""}
      </span>
    </header>
    {children}
  </section>
);

const TileGrid = ({ tiles }: { tiles: HubTile[] }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
    {tiles.map((tile) => (
      <MagazineTile key={tile.path} tile={tile} />
    ))}
  </div>
);

export const CategoryHub = ({
  titleKey,
  description,
  tiles,
  groups,
  stats,
  featuredEyebrow,
  featuredHeadline,
  featuredCopy,
}: CategoryHubProps) => {
  const { t } = useTranslation();
  const title = t(titleKey);

  // Pick the featured tile + flatten remaining tiles for the first section.
  const allGroups: TileGroup[] = groups && groups.length > 0
    ? groups
    : tiles && tiles.length > 0
      ? [{ label: "Categories", tiles }]
      : [];

  const featuredTile = allGroups[0]?.tiles[0];
  const firstGroupRest = allGroups[0]?.tiles.slice(1) ?? [];
  const restGroups = allGroups.slice(1);

  // Auto-generate sidebar stats so every hub gets the magazine layout
  // even when the caller hasn't supplied custom KPIs.
  const totalTiles = allGroups.reduce((n, g) => n + g.tiles.length, 0);
  const topSection = allGroups.reduce<TileGroup | undefined>(
    (best, g) => (!best || g.tiles.length > best.tiles.length ? g : best),
    undefined,
  );
  const featuredLabel = featuredTile ? t(featuredTile.labelKey) : "—";
  const resolvedStats: HubStat[] =
    stats && stats.length > 0
      ? stats
      : [
          { label: "Tiles", value: totalTiles, hint: "Across this hub" },
          { label: "Sections", value: allGroups.length, hint: "Grouped categories" },
          { label: "Largest Section", value: topSection?.tiles.length ?? 0, hint: topSection?.label?.toUpperCase() },
          { label: "Featured", value: featuredLabel.toUpperCase(), hint: "Top of the page" },
          { label: "Status", value: "LIVE", hint: "Synced with your career" },
        ];

  return (
    <FMPageScaffold title={title} subtitle={description} eyebrow={featuredEyebrow}>
      {featuredTile && (
        <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <FeaturedTile
            tile={featuredTile}
            eyebrow={featuredEyebrow || "Featured"}
            headline={featuredHeadline}
            copy={featuredCopy}
          />
          <StatsSidebar stats={resolvedStats} />
        </div>
      )}

      {firstGroupRest.length > 0 && (
        <SectionBand label={allGroups[0].label}>
          <TileGrid tiles={firstGroupRest} />
        </SectionBand>
      )}

      {restGroups.map((group) => (
        <SectionBand key={group.label} label={group.label}>
          <TileGrid tiles={group.tiles} />
        </SectionBand>
      ))}
    </FMPageScaffold>
  );
};

export default CategoryHub;
