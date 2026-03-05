import { useMemo } from "react";
import { projectCoordinates } from "@/utils/mapProjection";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface RoutePoint {
  cityName: string;
  country: string;
  lat: number;
  lng: number;
  index: number;
  status: "completed" | "scheduled" | "in_progress" | string;
}

interface TourRouteMapProps {
  points: RoutePoint[];
}

const MAP_WIDTH = 800;
const MAP_HEIGHT = 400;
const PADDING = 30;
const PIN_RADIUS = 10;

export const TourRouteMap = ({ points }: TourRouteMapProps) => {
  const projected = useMemo(() => {
    return points.map((p) => {
      const { x, y } = projectCoordinates(
        { lat: p.lat, lng: p.lng },
        { width: MAP_WIDTH, height: MAP_HEIGHT, padding: PADDING }
      );
      return { ...p, x, y };
    });
  }, [points]);

  if (projected.length < 2) return null;

  // Build polyline segments colored by status
  const segments: { x1: number; y1: number; x2: number; y2: number; completed: boolean }[] = [];
  for (let i = 0; i < projected.length - 1; i++) {
    segments.push({
      x1: projected[i].x,
      y1: projected[i].y,
      x2: projected[i + 1].x,
      y2: projected[i + 1].y,
      completed: projected[i].status === "completed",
    });
  }

  return (
    <TooltipProvider delayDuration={0}>
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="w-full h-auto rounded-lg border border-border bg-muted/40"
        style={{ maxHeight: 260 }}
      >
        {/* Simple world grid lines for context */}
        {[...Array(7)].map((_, i) => {
          const y = (MAP_HEIGHT / 7) * (i + 1);
          return <line key={`h${i}`} x1={0} y1={y} x2={MAP_WIDTH} y2={y} className="stroke-border/30" strokeWidth={0.5} />;
        })}
        {[...Array(11)].map((_, i) => {
          const x = (MAP_WIDTH / 11) * (i + 1);
          return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={MAP_HEIGHT} className="stroke-border/30" strokeWidth={0.5} />;
        })}

        {/* Route lines */}
        {segments.map((seg, i) => (
          <line
            key={`seg-${i}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            className={seg.completed ? "stroke-green-500" : "stroke-primary"}
            strokeWidth={2}
            strokeDasharray={seg.completed ? "none" : "6 3"}
            strokeOpacity={0.7}
          />
        ))}

        {/* City pins */}
        {projected.map((p) => {
          const isActive = p.status === "in_progress";
          const isCompleted = p.status === "completed";

          return (
            <Tooltip key={p.index}>
              <TooltipTrigger asChild>
                <g className="cursor-pointer">
                  {/* Pulse ring for active gig */}
                  {isActive && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={PIN_RADIUS + 4}
                      className="fill-none stroke-primary"
                      strokeWidth={2}
                      opacity={0.6}
                    >
                      <animate
                        attributeName="r"
                        from={String(PIN_RADIUS + 2)}
                        to={String(PIN_RADIUS + 10)}
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        from="0.6"
                        to="0"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Pin circle */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={PIN_RADIUS}
                    className={
                      isCompleted
                        ? "fill-green-500 stroke-green-700"
                        : isActive
                        ? "fill-primary stroke-primary-foreground"
                        : "fill-muted-foreground/60 stroke-muted-foreground"
                    }
                    strokeWidth={1.5}
                  />

                  {/* Number label */}
                  <text
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-primary-foreground font-bold select-none pointer-events-none"
                    fontSize={10}
                  >
                    {p.index + 1}
                  </text>
                </g>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{p.cityName}, {p.country}</p>
                <p className="text-muted-foreground capitalize">{p.status}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </svg>
    </TooltipProvider>
  );
};
