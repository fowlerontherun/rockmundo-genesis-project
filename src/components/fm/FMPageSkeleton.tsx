import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface FMPageSkeletonProps {
  /** How many KPI/stat cards to render across the top. Set 0 to hide. */
  kpiCount?: number;
  /** How many action button placeholders to render. */
  actionCount?: number;
  /** How many body content blocks (cards) to render. */
  bodyBlocks?: number;
  /** Optional className overrides. */
  className?: string;
  /** Toggle the tab/filter strip row. */
  showTabs?: boolean;
}

/**
 * Standardized loading skeleton for detail pages wrapped in <FMPageScaffold>.
 * Renders a consistent ladder: action placeholders → KPI strip → tabs → body blocks.
 */
export const FMPageSkeleton = ({
  kpiCount = 4,
  actionCount = 2,
  bodyBlocks = 1,
  className,
  showTabs = false,
}: FMPageSkeletonProps) => (
  <div className={cn("space-y-4", className)} aria-busy="true" aria-live="polite">
    {actionCount > 0 && (
      <div className="flex items-center gap-2 justify-end">
        {Array.from({ length: actionCount }).map((_, i) => (
          <Skeleton key={`act-${i}`} className="h-8 w-24 rounded-sm" />
        ))}
      </div>
    )}

    {kpiCount > 0 && (
      <div
        className={cn(
          "grid gap-3",
          kpiCount >= 4
            ? "grid-cols-2 md:grid-cols-4"
            : kpiCount === 3
            ? "grid-cols-3"
            : "grid-cols-2",
        )}
      >
        {Array.from({ length: kpiCount }).map((_, i) => (
          <Skeleton key={`kpi-${i}`} className="h-20 rounded-sm" />
        ))}
      </div>
    )}

    {showTabs && (
      <div className="flex items-center gap-2 border-b border-fm-border pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`tab-${i}`} className="h-7 w-20 rounded-sm" />
        ))}
      </div>
    )}

    {Array.from({ length: bodyBlocks }).map((_, i) => (
      <div key={`body-${i}`} className="space-y-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-64 w-full rounded-sm" />
      </div>
    ))}
  </div>
);

/**
 * Compact skeleton variant for live-performance / wizard branches where a
 * single big content block is loading (no KPI strip).
 */
export const FMLiveSkeleton = ({ className }: { className?: string }) => (
  <div className={cn("space-y-4", className)} aria-busy="true" aria-live="polite">
    <div className="flex items-center gap-2 justify-end">
      <Skeleton className="h-8 w-20 rounded-sm" />
      <Skeleton className="h-8 w-28 rounded-sm" />
    </div>
    <Skeleton className="h-12 w-2/3" />
    <div className="grid gap-3 grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-sm" />
      ))}
    </div>
    <Skeleton className="h-80 w-full rounded-sm" />
  </div>
);

export default FMPageSkeleton;
