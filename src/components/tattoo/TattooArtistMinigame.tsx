import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Crosshair, RotateCcw } from "lucide-react";

export type TattooMinigameResult = {
  accuracy: number;
  coverage: number;
  mistakes: number;
  score: number;
  difficulty: number;
};

type Props = {
  difficulty?: number;
  skillLevel?: number;
  designName?: string;
  onComplete: (result: TattooMinigameResult) => void;
  onCancel?: () => void;
};

type Point = { x: number; y: number };

const SHAPES = [
  "M70 176 C83 130 105 96 150 72 C195 96 217 130 230 176 C205 158 181 151 150 169 C119 151 95 158 70 176",
  "M62 190 C88 151 88 108 125 89 C145 79 156 54 150 37 C184 61 198 92 180 120 C219 108 242 133 247 164 C214 150 190 158 174 188 C155 218 108 221 62 190",
  "M150 30 L176 106 L258 106 L192 156 L217 236 L150 188 L83 236 L108 156 L42 106 L124 106 Z",
  "M43 210 C68 126 102 64 150 36 C198 64 232 126 257 210 C210 177 185 143 150 114 C115 143 90 177 43 210 M96 213 C120 177 136 154 150 144 C164 154 180 177 204 213",
  "M34 205 C57 102 109 52 150 29 C191 52 243 102 266 205 C218 170 190 132 150 109 C110 132 82 170 34 205 M66 224 C106 193 130 179 150 179 C170 179 194 193 234 224 M88 105 C111 83 130 75 150 75 C170 75 189 83 212 105",
];

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function TattooArtistMinigame({
  difficulty = 1,
  skillLevel = 0,
  designName = "Stencil",
  onComplete,
  onCancel,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [coveredSamples, setCoveredSamples] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [onStencilMoves, setOnStencilMoves] = useState(0);
  const [totalMoves, setTotalMoves] = useState(0);
  const [finished, setFinished] = useState(false);

  const level = clamp(Math.round(difficulty), 1, 5);
  const steadiness = clamp(skillLevel / 1000, 0, 1);
  const tolerance = 17 - level * 1.65 + steadiness * 8;
  const wobble = Math.max(0.7, 5.5 + level * 1.2 - steadiness * 7.5);
  const sampleCount = 70 + level * 22;
  const minimumCoverage = 68 + level * 3;
  const scale = 0.84 + level * 0.04;
  const transform = `translate(150 130) scale(${scale}) translate(-150 -130)`;

  const trace = useMemo(
    () =>
      points.length < 2
        ? ""
        : points
            .map(
              (point, index) =>
                `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
            )
            .join(" "),
    [points],
  );

  const coverage = clamp(
    Math.round((coveredSamples.length / sampleCount) * 100),
    0,
    100,
  );
  const hitRate = totalMoves > 0 ? onStencilMoves / totalMoves : 1;
  const accuracy = clamp(
    Math.round(hitRate * 100 - mistakes * (0.8 + level * 0.2)),
    0,
    100,
  );

  const getWobbledPoint = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    const time = performance.now() / 90;
    return {
      x:
        ((event.clientX - rect.left) / rect.width) * 300 +
        Math.sin(time * 1.7) * wobble +
        Math.cos(time * 0.72) * wobble * 0.35,
      y:
        ((event.clientY - rect.top) / rect.height) * 260 +
        Math.cos(time * 1.35) * wobble +
        Math.sin(time * 0.84) * wobble * 0.35,
    };
  };

  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing || finished) return;

    const point = getWobbledPoint(event);
    setPoints((previous) => [...previous, point]);
    setTotalMoves((value) => value + 1);

    const target = event.currentTarget.querySelector<SVGPathElement>("#tattoo-stencil");
    if (!target) return;

    const totalLength = target.getTotalLength();
    let nearestDistance = Number.POSITIVE_INFINITY;
    let nearestIndex = -1;

    for (let index = 0; index < sampleCount; index += 1) {
      const sample = target.getPointAtLength(
        (totalLength * index) / Math.max(1, sampleCount - 1),
      );
      const transformedSample = {
        x: 150 + (sample.x - 150) * scale,
        y: 130 + (sample.y - 130) * scale,
      };
      const distance = Math.hypot(
        transformedSample.x - point.x,
        transformedSample.y - point.y,
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }

    if (nearestDistance <= tolerance) {
      setOnStencilMoves((value) => value + 1);
      setCoveredSamples((previous) => {
        const next = new Set(previous);
        for (let offset = -1; offset <= 1; offset += 1) {
          const index = nearestIndex + offset;
          if (index >= 0 && index < sampleCount) next.add(index);
        }
        return Array.from(next);
      });
    } else if (totalMoves % 3 === 0) {
      setMistakes((value) => value + 1);
    }
  };

  const reset = () => {
    setDrawing(false);
    setPoints([]);
    setCoveredSamples([]);
    setMistakes(0);
    setOnStencilMoves(0);
    setTotalMoves(0);
    setFinished(false);
  };

  const finish = () => {
    const score = clamp(
      Math.round(accuracy * 0.62 + coverage * 0.38 - mistakes * 0.25),
      0,
      100,
    );
    setFinished(true);
    onComplete({ accuracy, coverage, mistakes, score, difficulty: level });
  };

  const canFinish = coverage >= minimumCoverage && totalMoves >= 30 && !finished;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex flex-wrap justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5" />
            Tattoo Machine: {designName}
          </CardTitle>
          <div className="flex gap-2">
            <Badge>Level {level}</Badge>
            <Badge variant="outline">Need {minimumCoverage}% coverage</Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Hold down and trace the faint stencil. Only stencil sections you actually
          pass over count as coverage. Your tattooing skill steadies the machine.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded bg-muted p-2">
            <b>{accuracy}%</b>
            <br />Accuracy
          </div>
          <div className="rounded bg-muted p-2">
            <b>{coverage}%</b>
            <br />Stencil covered
          </div>
          <div className="rounded bg-muted p-2">
            <b>{mistakes}</b>
            <br />Mistakes
          </div>
        </div>
        <Progress value={coverage} />
        <div className="rounded-xl border bg-amber-100 p-2">
          <svg
            ref={svgRef}
            viewBox="0 0 300 260"
            className="w-full touch-none cursor-crosshair"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDrawing(true);
            }}
            onPointerMove={move}
            onPointerUp={() => setDrawing(false)}
            onPointerCancel={() => setDrawing(false)}
          >
            <rect width="300" height="260" rx="18" fill="hsl(28 55% 76%)" />
            <path
              id="tattoo-stencil"
              d={SHAPES[level - 1]}
              transform={transform}
              fill="none"
              stroke="black"
              strokeWidth={Math.max(4, tolerance * 0.55)}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity=".18"
            />
            <path
              d={SHAPES[level - 1]}
              transform={transform}
              fill="none"
              stroke="black"
              strokeWidth="1.3"
              strokeDasharray="5 5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity=".55"
            />
            {trace && (
              <path
                d={trace}
                fill="none"
                stroke="hsl(220 25% 9%)"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs">
          <span>
            Wobble {wobble.toFixed(1)} · tolerance {tolerance.toFixed(1)} · design
            scale {Math.round(scale * 100)}%
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="mr-1 h-4 w-4" />Retry
            </Button>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button size="sm" disabled={!canFinish} onClick={finish}>
              {coverage < minimumCoverage
                ? `Cover ${minimumCoverage - coverage}% more`
                : "Finish tattoo"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
