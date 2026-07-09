import type { ReactNode } from "react";
import { AlertCircle, Inbox, Loader2, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageStateProps = {
  title: string;
  description?: ReactNode;
  className?: string;
  action?: ReactNode;
};

export function PageLoadingState({ title = "Loading", description = "Getting everything ready...", className }: Partial<PageStateProps>) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="font-medium text-foreground">{title}</p>
            {description && <p className="text-sm">{description}</p>}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </CardContent>
    </Card>
  );
}

export function PageEmptyState({ title, description, className, action }: PageStateProps) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Inbox className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

type PageErrorStateProps = PageStateProps & {
  onRetry?: () => void;
  retryLabel?: string;
};

export function PageErrorState({
  title,
  description = "Something interrupted the encore. Please try again.",
  className,
  action,
  onRetry,
  retryLabel = "Try again",
}: PageErrorStateProps) {
  return (
    <Alert variant="destructive" className={cn("bg-destructive/10", className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2 flex flex-col gap-3">
        <span>{description}</span>
        {(onRetry || action) && (
          <span className="flex flex-wrap gap-2">
            {onRetry && (
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                {retryLabel}
              </Button>
            )}
            {action}
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}
