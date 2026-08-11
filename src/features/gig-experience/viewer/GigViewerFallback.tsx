import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function GigViewerFallback({
  title,
  body,
  onRetry,
  onResult,
  onClose,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
  onResult?: () => void;
  onClose?: () => void;
}) {
  return (
    <Card role="status">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{body}</p>
        {onRetry || onResult || onClose ? (
          <div className="flex flex-wrap gap-2">
            {onRetry ? <Button variant="outline" onClick={onRetry}>Retry</Button> : null}
            {onResult ? <Button onClick={onResult}>View Report</Button> : null}
            {onClose ? <Button variant="ghost" onClick={onClose}>Close Viewer</Button> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
