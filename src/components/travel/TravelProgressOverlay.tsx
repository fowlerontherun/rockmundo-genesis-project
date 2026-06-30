import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Plane,
  MapPin,
  Clock,
  BookOpen,
  PenTool,
  MessageSquare,
  X,
  Train,
  Bus,
  Ship,
  Gauge,
  Compass,
  Coffee,
} from "lucide-react";
import { differenceInSeconds, format } from "date-fns";

const TRANSPORT_META: Record<
  string,
  { icon: any; label: string; speedKmh: number; tip: string }
> = {
  plane: {
    icon: Plane,
    label: "Plane",
    speedKmh: 1100,
    tip: "Cruising at altitude — enjoy the view.",
  },
  train: {
    icon: Train,
    label: "Train",
    speedKmh: 260,
    tip: "Smooth ride. Perfect for songwriting.",
  },
  bus: {
    icon: Bus,
    label: "Bus",
    speedKmh: 80,
    tip: "Long haul — stretch your legs at stops.",
  },
  tour_bus: {
    icon: Bus,
    label: "Tour Bus",
    speedKmh: 95,
    tip: "Rolling with the band. Bunk up or jam.",
  },
  ship: {
    icon: Ship,
    label: "Ship",
    speedKmh: 55,
    tip: "Sea legs — slow and steady wins.",
  },
};

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
  const [elapsedLabel, setElapsedLabel] = useState("");

  const meta =
    TRANSPORT_META[transportType?.toLowerCase() || "plane"] ||
    TRANSPORT_META.plane;
  const TransportIcon = meta.icon;

  const totalDurationHours = useMemo(
    () => Math.max(0, differenceInSeconds(arrivalTime, departureTime) / 3600),
    [arrivalTime, departureTime],
  );
  const estDistanceKm = useMemo(
    () => Math.round(totalDurationHours * meta.speedKmh),
    [totalDurationHours, meta.speedKmh],
  );

  useEffect(() => {
    const updateProgress = () => {
      const now = new Date();
      const totalDuration = differenceInSeconds(arrivalTime, departureTime);
      const elapsed = differenceInSeconds(now, departureTime);
      const newProgress = Math.min(
        100,
        Math.max(0, (elapsed / totalDuration) * 100),
      );
      setProgress(newProgress);

      const remaining = differenceInSeconds(arrivalTime, now);
      const fmt = (s: number) => {
        if (s <= 0) return "0s";
        if (s < 60) return `${s}s`;
        if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return `${h}h ${m}m`;
      };
      setTimeRemaining(remaining <= 0 ? "Arriving..." : fmt(remaining));
      setElapsedLabel(fmt(Math.max(0, elapsed)));
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, [arrivalTime, departureTime]);

  const allowedActivities = [
    {
      icon: PenTool,
      label: "Write Songs",
      path: "/songwriting",
      description: "Work on lyrics and melodies",
    },
    {
      icon: BookOpen,
      label: "Read Books",
      path: "/education",
      description: "Study music theory",
    },
    {
      icon: MessageSquare,
      label: "Twaater",
      path: "/twaater",
      description: "Post updates to fans",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-primary/30 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 relative">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <TransportIcon className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Currently Traveling</CardTitle>
          <p className="text-xs text-muted-foreground mt-1 italic">
            {meta.tip}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Route Info */}
          <div className="flex items-center justify-center gap-3 text-center">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">From</p>
              <p className="font-semibold">{departureCity || "Unknown"}</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {format(departureTime, "MMM d, HH:mm")}
              </p>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-8 h-px bg-muted-foreground/30" />
              <TransportIcon className="h-4 w-4" />
              <div className="w-8 h-px bg-muted-foreground/30" />
            </div>
            <div className="text-left">
              <p className="text-sm text-muted-foreground">To</p>
              <p className="font-semibold">{destinationCity}</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {format(arrivalTime, "MMM d, HH:mm")}
              </p>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Travel Progress</span>
              <span className="font-mono">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>Elapsed {elapsedLabel}</span>
              <span>Total {totalDurationHours.toFixed(1)}h</span>
            </div>
          </div>

          {/* Detailed metrics */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground tracking-wide">
                Time Left
              </p>
              <p className="text-base font-bold font-mono">{timeRemaining}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <MapPin className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground tracking-wide">
                Arrival
              </p>
              <p className="text-base font-bold">
                {format(arrivalTime, "HH:mm")}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <Gauge className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground tracking-wide">
                Cruise Speed
              </p>
              <p className="text-base font-bold font-mono">
                {meta.speedKmh} km/h
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <Compass className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground tracking-wide">
                ~ Distance
              </p>
              <p className="text-base font-bold font-mono">
                {estDistanceKm.toLocaleString()} km
              </p>
            </div>
          </div>

          {/* Transport Badge */}
          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary" className="capitalize gap-1">
              <TransportIcon className="h-3 w-3" /> {meta.label}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Coffee className="h-3 w-3" /> Onboard
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
                    <p className="text-xs text-muted-foreground">
                      {activity.description}
                    </p>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Cancel Button */}
          {canCancel && onCancel && (
            <Button variant="destructive" className="w-full" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel Travel (50% Refund)
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
