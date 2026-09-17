import { useMemo, useState } from "react";
import { MonitorPlay, PlayCircle, Tv2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TotpBroadcastReplay } from "./api";
import { buildTotpShotGrammar, type TotpStageKey } from "./broadcastProfile";
import { buildTotpPerformanceTimeline } from "./broadcastTimeline";
import { TOTP_PRESENTERS, resolveTotpPresenter, type TotpPresenterKey } from "./presenters";
import { TotpArchivePlayer } from "./TotpArchivePlayer";
import { TotpShowIntro } from "./TotpShowIntro";

const DEMO_PERFORMANCE_MS = 45_000;
const DEMO_TOTAL_MS = 56_000;

const STAGES: Array<{ key: TotpStageKey; label: string }> = [
  { key: "main_stage", label: "Main stage" },
  { key: "stage_b", label: "Stage B" },
  { key: "rock_stage", label: "Rock stage" },
  { key: "studio_floor", label: "Studio floor" },
];

const AUDIENCE_REACTIONS = [
  { value: -8, label: "Nervous" },
  { value: 0, label: "Settled" },
  { value: 6, label: "Loud" },
  { value: 10, label: "Roaring" },
];

function buildDemoReplay(presenterKey: TotpPresenterKey, stage: TotpStageKey, audienceReaction: number): TotpBroadcastReplay {
  const presenter = resolveTotpPresenter(presenterKey);
  const showVariant = presenterKey === "alex_rayne" ? "regular" : "guest_host";
  const presenterIntro = `${presenter.displayName}: They're at number seven this week. Live from our London studio, this is The Voltage with Neon Hearts!`;
  const cues = buildTotpPerformanceTimeline({
    artistName: "The Voltage",
    songTitle: "Neon Hearts",
    chartRank: 7,
    presenterIntro,
    stage,
    performanceDurationMs: DEMO_PERFORMANCE_MS,
    shots: buildTotpShotGrammar({ genre: "rock", energy: "high", performerCount: 4 }),
    trendChange: 5,
  });

  return {
    id: `totp-admin-demo-${presenterKey}-${stage}-${audienceReaction}`,
    performance_id: "00000000-0000-4000-8000-000000000701",
    replay_version: 4,
    stage_key: stage,
    presenter_key: presenterKey,
    duration_ms: DEMO_TOTAL_MS,
    checksum: `totp-admin-demo-${presenterKey}-${stage}-${audienceReaction}-read-only`,
    generated_at: "2026-09-17T20:00:00.000Z",
    payload: {
      schemaVersion: 4,
      episodeId: "00000000-0000-4000-8000-000000000700",
      episodeNumber: 1,
      episodeDate: "2026-09-17",
      broadcastAt: "2026-09-17T20:00:00.000Z",
      performanceId: "00000000-0000-4000-8000-000000000701",
      runningOrder: 4,
      presenterKey,
      presenterDisplayName: presenter.displayName,
      showVariant,
      liveTv: { audienceReaction },
      band: {
        id: "00000000-0000-4000-8000-000000000702",
        name: "The Voltage",
        members: [
          { profile_id: "00000000-0000-4000-8000-000000000711", display_name: "Avery Stone", role: "lead vocals", vocal_role: "Lead vocals", visual_snapshot: { richClothing: [] } },
          { profile_id: "00000000-0000-4000-8000-000000000712", display_name: "Riley Knox", role: "guitar", instrument_role: "Electric guitar", visual_snapshot: { richClothing: [] } },
          { profile_id: "00000000-0000-4000-8000-000000000713", display_name: "Morgan Vale", role: "bass", instrument_role: "Bass guitar", visual_snapshot: { richClothing: [] } },
          { profile_id: "00000000-0000-4000-8000-000000000714", display_name: "Jamie Rush", role: "drums", instrument_role: "Drums", visual_snapshot: { richClothing: [] } },
        ],
      },
      song: {
        id: "00000000-0000-4000-8000-000000000720",
        title: "Neon Hearts",
        genre: "Rock",
        qualifyingRank: 7,
      },
      stage,
      performanceDurationMs: DEMO_PERFORMANCE_MS,
      totalDurationMs: DEMO_TOTAL_MS,
      cues,
    },
  };
}

export function TotpAdminDemo() {
  const [presenterKey, setPresenterKey] = useState<TotpPresenterKey>("alex_rayne");
  const [stage, setStage] = useState<TotpStageKey>("main_stage");
  const [audienceReaction, setAudienceReaction] = useState(6);
  const [showIntro, setShowIntro] = useState(false);
  const replay = useMemo(() => buildDemoReplay(presenterKey, stage, audienceReaction), [presenterKey, stage, audienceReaction]);

  return (
    <Card className="border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/5 via-background to-cyan-500/5" data-totp-admin-demo>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><MonitorPlay className="h-5 w-5" /> TV studio demo</CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              Safe preview of the real Top of the Pops 3D television renderer. It uses the production studio, presenter models, directed camera grammar, chart graphics and audience choreography without reading or changing a live episode.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => setShowIntro(true)}>
            <PlayCircle className="mr-2 h-4 w-4" /> Preview programme intro
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm font-medium">
            <span>Presenter</span>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={presenterKey}
              onChange={(event) => setPresenterKey(event.target.value as TotpPresenterKey)}
            >
              {Object.values(TOTP_PRESENTERS).map((presenter) => <option key={presenter.key} value={presenter.key}>{presenter.displayName}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>Performance space</span>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={stage}
              onChange={(event) => setStage(event.target.value as TotpStageKey)}
            >
              {STAGES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>Studio audience</span>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={audienceReaction}
              onChange={(event) => setAudienceReaction(Number(event.target.value))}
            >
              {AUDIENCE_REACTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
          <Tv2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <span><strong className="text-foreground">Read-only demo:</strong> no chart position, fame, cash, achievements, invitations, attendance or episode state can be changed from this preview.</span>
        </div>

        {showIntro && <TotpShowIntro playing onEnded={() => setShowIntro(false)} />}
        <TotpArchivePlayer replay={replay} />
      </CardContent>
    </Card>
  );
}

export default TotpAdminDemo;
