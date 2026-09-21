import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListVideo, ShieldCheck } from "lucide-react";
import { TotpFullEpisodePlayer } from "./TotpFullEpisodePlayer";
import type { TotpChartRundown } from "./chartRundownApi";
import type { TotpTestPreviewPerformance } from "./testPreviewApi";
import {
  buildTotpTestReplay,
  combineTotpTestEffects,
  getTotpTestIncident,
  getTotpTestStyleOutcome,
} from "./testLifecycle";

export function TotpFullShowDemo({
  performances,
  seed,
  generatedAt,
  chartRundown,
  onExit,
}: {
  performances: TotpTestPreviewPerformance[];
  seed: string;
  generatedAt: string;
  chartRundown?: TotpChartRundown | null;
  onExit: () => void;
}) {
  const replays = useMemo(
    () => performances
      .slice()
      .sort((a, b) => a.running_order - b.running_order)
      .map((performance, index) => {
        const bookedPerformance = { ...performance, running_order: index + 1 };
        const style = getTotpTestStyleOutcome(seed, bookedPerformance, "polished");
        const incident = getTotpTestIncident(seed, bookedPerformance);
        const audienceReaction = combineTotpTestEffects(
          incident.effects,
          style?.effects ?? { reputation: 0, fan_sentiment: 0, media_intensity: 0, audience_reaction: 0 },
        ).audience_reaction;
        return buildTotpTestReplay(bookedPerformance, seed, generatedAt, audienceReaction);
      }),
    [generatedAt, performances, seed],
  );

  return (
    <Card className="border-primary/30 bg-primary/[0.03]" data-totp-full-show-demo>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListVideo className="h-5 w-5" /> Booked full-show demo
            </CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              This runs the complete mock programme using the booked demo lineup: countdown, titles, presenter links,
              stage transitions, performances, chart rundown and credits. Song titles stay on screen; presenter speech
              is band-led. Nothing in this preview creates invitations, rewards, history or progression.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3 w-3" /> zero gameplay writes
            </Badge>
            <Badge variant="secondary">{performances.length} booked acts</Badge>
            <Button size="sm" variant="outline" onClick={onExit}>Edit demo booking</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {performances
            .slice()
            .sort((a, b) => a.running_order - b.running_order)
            .map((performance) => (
              <Badge key={`${performance.band_id}:${performance.song_id}`} variant="outline">
                {performance.running_order}. {performance.band_name}
              </Badge>
            ))}
        </div>
        <TotpFullEpisodePlayer replays={replays} chartRundown={chartRundown ?? null} />
      </CardContent>
    </Card>
  );
}

export default TotpFullShowDemo;
