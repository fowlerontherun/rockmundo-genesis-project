import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plane, MapPin, Clock, BookOpen, PenTool, MessageSquare, X } from "lucide-react";
import { differenceInSeconds, differenceInMinutes, format } from "date-fns";

interface TravelProgressOverlayProps {
  destinationCity: string;
  departureCity?: string;
  arrivalTime: Date;
  departureTime: Date;
  transportType?: string;
  onCancel?: () => void;
  canCancel?: boolean;
}

export function TravelProgressOverlay({
  destinationCity,
  departureCity,
  arrivalTime,
  departureTime,
  transportType = "plane",
  onCancel,
  canCancel = true,
}: TravelProgressOverlayProps) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState("");

  useEffect(() => {
    const updateProgress = () => {
      const now = new Date();
      const totalDuration = differenceInSeconds(arrivalTime, departureTime);
      const elapsed = differenceInSeconds(now, departureTime);
      const newProgress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
      setProgress(newProgress);

      const remaining = differenceInSeconds(arrivalTime, now);
      if (remaining <= 0) {
        setTimeRemaining("Arriving...");
      } else if (remaining < 60) {
        setTimeRemaining(`${remaining}s`);
      } else if (remaining < 3600) {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        setTimeRemaining(`${mins}m ${secs}s`);
      } else {
        const hours = Math.floor(remaining / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        setTimeRemaining(`${hours}h ${mins}m`);
      }
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, [arrivalTime, departureTime]);

  const allowedActivities = [
    { icon: PenTool, label: "Write Songs", path: "/songwriting", description: "Work on lyrics and melodies" },
    { icon: BookOpen, label: "Read Books", path: "/library", description: "Study music theory" },
    { icon: MessageSquare, label: "Twaater", path: "/twaater", description: "Post updates to fans" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-primary/30 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 relative">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Plane className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Currently Traveling</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Route Info */}
          <div className="flex items-center justify-center gap-3 text-center">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">From</p>
              <p className="font-semibold">{departureCity || "Unknown"}</p>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-8 h-px bg-muted-foreground/30" />
              <Plane className="h-4 w-4 rotate-90" />
              <div className="w-8 h-px bg-muted-foreground/30" />
            </div>
            <div className="text-left">
              <p className="text-sm text-muted-foreground">To</p>
              <p className="font-semibold">{destinationCity}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Travel Progress</span>
              <span className="font-mono">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          {/* Time Info */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-3 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Time Remaining</p>
              <p className="text-lg font-bold font-mono">{timeRemaining}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <MapPin className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Arrival</p>
              <p className="text-lg font-bold">{format(arrivalTime, "HH:mm")}</p>
            </div>
          </div>

          {/* Transport Badge */}
          <div className="text-center">
            <Badge variant="secondary" className="capitalize">
              {transportType}
            </Badge>
          </div>

          {/* Allowed Activities */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              While traveling, you can still:
            </p>
            <div className="grid gap-2">
              {allowedActivities.map((activity) => (
                <Button
                  key={activity.path}
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3"
                  onClick={() => navigate(activity.path)}
                >
                  <activity.icon className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{activity.label}</p>
                    <p className="text-xs text-muted-foreground">{activity.description}</p>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Cancel Button */}
          {canCancel && onCancel && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={onCancel}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel Travel (50% Refund)
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
