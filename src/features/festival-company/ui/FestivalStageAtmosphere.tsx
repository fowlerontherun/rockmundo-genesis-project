import type { FestivalRuntimeWeatherState } from "../domain/festivalRuntime";

interface FestivalStageAtmosphereProps {
  weatherState?: FestivalRuntimeWeatherState | null;
  activePerformance: boolean;
}

// Purely illustrative people: never use these counts for attendance, capacity,
// congestion, queue length or any other runtime metric.
const silhouettes = [9, 13, 11, 15, 10, 14, 12, 9, 14, 11, 13] as const;
const rainLines = [10, 21, 31, 43, 56, 67, 78, 91] as const;

export function FestivalStageAtmosphere({
  weatherState,
  activePerformance,
}: FestivalStageAtmosphereProps) {
  const rain = weatherState === "light_rain" || weatherState === "heavy_rain" || weatherState === "storm";
  const heavy = weatherState === "heavy_rain" || weatherState === "storm";
  const wind = weatherState === "high_wind" || weatherState === "storm";
  const overcast = weatherState === "cloudy" || rain;

  return (
    <div aria-hidden="true" data-testid="festival-stage-illustration" className="pointer-events-none absolute inset-0 overflow-hidden">
      {overcast && (
        <span data-weather-visual="cloud" className="absolute right-3 top-1 h-3 w-12 rounded-full bg-slate-300/30 blur-sm" />
      )}
      {rain && rainLines.slice(0, heavy ? 8 : 4).map((position, i) => (
        <span
          key={position}
          data-weather-visual="rain"
          className="absolute top-1 h-3 w-px rotate-12 bg-sky-200/60"
          style={{ left: `${position}%`, top: `${(i % 3) * 8 + 3}%` }}
        />
      ))}
      {wind && (
        <span data-weather-visual="wind" className="absolute left-4 top-4 h-px w-16 -rotate-6 bg-sky-100/50" />
      )}
      {weatherState === "storm" && (
        <span data-weather-visual="storm" className="absolute right-5 top-2 text-xs text-yellow-100">⚡</span>
      )}
      <div data-testid="festival-illustrated-crowd" className="absolute inset-x-1 bottom-0 flex h-6 items-end justify-center gap-1">
        {silhouettes.map((height, index) => (
          <span
            key={index}
            data-crowd-figure="illustration"
            className={`relative block w-2 shrink-0 rounded-t-full bg-slate-950/90 ${activePerformance ? "motion-safe:animate-bounce" : ""}`}
            style={{
              height,
              animationDuration: `${1.3 + (index % 4) * 0.23}s`,
              animationDelay: `${(index % 5) * -0.27}s`,
            }}
          >
            <span className="absolute -top-1 left-0.5 h-1.5 w-1.5 rounded-full bg-slate-950" />
          </span>
        ))}
      </div>
    </div>
  );
}
