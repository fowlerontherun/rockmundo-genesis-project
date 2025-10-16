import { AlertTriangle, Clock, DollarSign, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { TravelDisruption } from "@/utils/gameCalendar";

interface WeatherDisruptionAlertProps {
  disruption: TravelDisruption;
}

export function WeatherDisruptionAlert({ disruption }: WeatherDisruptionAlertProps) {
  const severityColors = {
    1: "bg-yellow-500/10 border-yellow-500/50",
    2: "bg-orange-500/10 border-orange-500/50",
    3: "bg-red-500/10 border-red-500/50",
    4: "bg-red-600/10 border-red-600/50",
    5: "bg-red-700/10 border-red-700/50",
  };

  const severityClass = severityColors[disruption.severity as keyof typeof severityColors] || severityColors[1];

  return (
    <Alert className={severityClass}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <span>Travel Disruption</span>
        <Badge variant="destructive" className="text-xs">
          Level {disruption.severity}
        </Badge>
      </AlertTitle>
      <AlertDescription className="space-y-2 mt-2">
        <p className="font-medium">{disruption.message}</p>
        <p className="text-sm text-muted-foreground capitalize">
          Cause: {disruption.cause.replace(/_/g, " ")}
        </p>
        
        <div className="flex flex-wrap gap-2 mt-3">
          {disruption.type === "cancelled" && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Route Cancelled
            </Badge>
          )}
          {disruption.type === "delayed" && disruption.delayHours && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              +{disruption.delayHours}h delay
            </Badge>
          )}
          {disruption.type === "expensive" && disruption.costMultiplier && (
            <Badge variant="secondary" className="gap-1">
              <DollarSign className="h-3 w-3" />
              {disruption.costMultiplier}x cost
            </Badge>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
