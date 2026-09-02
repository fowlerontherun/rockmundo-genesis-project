import { Button } from "@/components/ui/button";
import type { StoryModel } from "./engine/StoryEngine";
import { crowdMoodForEnergy } from "./engine/StoryEngine";

export function GigCrowdMoodGraph({
  story,
  positionMs,
  onSeek,
}: {
  story: StoryModel;
  positionMs: number;
  onSeek: (ms: number) => void;
}) {
  const points = story.songs.map((song, index) => ({
    x: story.songs.length <= 1 ? 50 : 8 + (index / (story.songs.length - 1)) * 84,
    y: 92 - crowdMoodForEnergy(song.energyAfter ?? song.energyBefore).energy * 0.84,
    song,
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const current = [...points].reverse().find((point) => positionMs >= point.song.startMs) ?? points[0];

  return (
    <section aria-labelledby="crowd-graph-heading" className="rounded-lg border bg-card p-3">
      <h3 id="crowd-graph-heading" className="font-semibold">Crowd mood graph</h3>
      <svg
        viewBox="0 0 100 100"
        className="mt-2 h-44 w-full overflow-visible"
        role="group"
        aria-label="Crowd energy by song interactive chart"
      >
        <path d="M8 92 H92" stroke="currentColor" opacity=".25" />
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
        {points.map((point) => (
          <g key={`${point.song.position}-${point.song.startMs}`}>
            <circle
              role="button"
              tabIndex={0}
              aria-label={`Seek to ${point.song.title}`}
              onClick={() => onSeek(point.song.startMs)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSeek(point.song.startMs);
                }
              }}
              cx={point.x}
              cy={point.y}
              r={point.song.isTurningPoint ? 4.5 : 3.5}
              fill={
                point.song.isBest
                  ? "#22c55e"
                  : point.song.isWeakest
                    ? "#f59e0b"
                    : point.song.isFinale
                      ? "#a855f7"
                      : "hsl(var(--primary))"
              }
            />
            <text x={point.x} y="99" textAnchor="middle" fontSize="5">{point.song.position}</text>
          </g>
        ))}
        {current && (
          <line
            x1={current.x}
            x2={current.x}
            y1="8"
            y2="92"
            stroke="#ef4444"
            strokeDasharray="2 2"
          />
        )}
      </svg>
      <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
        {story.songs.map((song) => (
          <Button
            key={`${song.position}-${song.startMs}`}
            variant="ghost"
            size="sm"
            className="h-auto justify-start whitespace-normal text-left"
            onClick={() => onSeek(song.startMs)}
          >
            {song.position}. {song.title} · {crowdMoodForEnergy(song.energyAfter ?? song.energyBefore).label}
            {song.isTurningPoint ? " · turning point" : ""}
            {song.isBest ? " · strongest" : ""}
            {song.isWeakest ? " · most difficult" : ""}
          </Button>
        ))}
      </div>
    </section>
  );
}
