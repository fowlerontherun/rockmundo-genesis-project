import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle2 } from "lucide-react";

interface ManufacturingProgressProps {
  createdAt: string;
  manufacturingCompleteAt: string | null;
  status: string;
}

export function ManufacturingProgress({ 
  createdAt, 
  manufacturingCompleteAt, 
  status 
}: ManufacturingProgressProps) {
  if (status !== "manufacturing" || !manufacturingCompleteAt) {
    return null;
  }

  const startTime = new Date(createdAt).getTime();
  const endTime = new Date(manufacturingCompleteAt).getTime();
  const now = Date.now();
  
  const totalDuration = endTime - startTime;
  const elapsed = now - startTime;
  const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  
  const remainingMs = Math.max(0, endTime - now);
  const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
  const remainingDays = Math.floor(remainingHours / 24);
  
  const isComplete = now >= endTime;

  const timeRemaining = isComplete 
    ? "Ready for release!" 
    : remainingDays > 0 
      ? `${remainingDays}d ${remainingHours % 24}h remaining`
      : `${remainingHours}h remaining`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />
          )}
          <span className="font-medium">Manufacturing Progress</span>
        </div>
        <span className={isComplete ? "text-green-500 font-medium" : "text-muted-foreground"}>
          {timeRemaining}
        </span>
      </div>
      <Progress 
        value={progress} 
        className={`h-2 ${isComplete ? "[&>div]:bg-green-500" : ""}`}
      />
      <div className="text-xs text-muted-foreground text-right">
        {Math.round(progress)}% complete
      </div>
    </div>
  );
}
