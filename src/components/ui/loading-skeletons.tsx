import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Generic loading skeleton for cards
export const CardSkeleton = ({ className }: { className?: string }) => (
  <Card className={cn("animate-pulse", className)}>
    <CardHeader className="pb-2">
      <Skeleton className="h-5 w-32" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-8 w-24 mb-2" />
      <Skeleton className="h-4 w-full" />
    </CardContent>
  </Card>
);

// Stats grid skeleton
export const StatsGridSkeleton = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {[...Array(4)].map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);

// List item skeleton
export const ListItemSkeleton = () => (
  <div className="flex items-center gap-3 p-3 animate-pulse">
    <Skeleton className="h-10 w-10 rounded-lg" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  </div>
);

// Activity feed skeleton
export const ActivityFeedSkeleton = () => (
  <Card>
    <CardHeader className="pb-2">
      <Skeleton className="h-5 w-32" />
    </CardHeader>
    <CardContent className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </CardContent>
  </Card>
);

// Table skeleton
export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div className="rounded-md border animate-pulse">
    <div className="border-b bg-muted/50 p-4">
      <div className="flex gap-4">
        {[...Array(cols)].map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
    </div>
    {[...Array(rows)].map((_, rowIndex) => (
      <div key={rowIndex} className="border-b last:border-0 p-4">
        <div className="flex gap-4">
          {[...Array(cols)].map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

// Page loading skeleton
export const PageLoadingSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
    <StatsGridSkeleton />
    <div className="grid md:grid-cols-2 gap-6">
      <ActivityFeedSkeleton />
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  </div>
);

// Inline loading spinner
export const InlineSpinner = ({ size = "sm" }: { size?: "sm" | "md" | "lg" }) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-muted border-t-primary",
        sizeClasses[size]
      )}
    />
  );
};

// Full page loader
export const FullPageLoader = ({ message = "Loading..." }: { message?: string }) => (
  <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
    <div className="text-center">
      <InlineSpinner size="lg" />
      <p className="mt-4 text-muted-foreground">{message}</p>
    </div>
  </div>
);
