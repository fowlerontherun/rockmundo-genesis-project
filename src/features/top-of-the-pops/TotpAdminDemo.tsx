import { AlertTriangle, MonitorPlay, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultAppearance } from "@/features/player-model/appearance";
import type { TotpBroadcastReplay } from "./api";
import { buildTotpShotGrammar, type TotpStageKey } from "./broadcastProfile";
import { buildTotpPerformanceTimeline } from "./broadcastTimeline";
import { TotpFullEpisodePlayer } from "./TotpFullEpisodePlayer";

interface DemoAct {
  replayId: string;
  performanceId: string;
  bandId: string;
  songId: string;
  profileId: string;
  bandName: string;
  songTitle: string;
  genre: string;
  rank: number;
  stage: TotpStageKey;
  role: string;
  instrumentRole?: string;
  vocalRole?: string;
  audienceReaction: number;
}

const DEMO_EPISODE_ID = "70000000-0000-4000-8000-000000000001";
const DEMO_DATE = "2026-10-01";
const DEMO_BROADCAST_AT = "2026-10-01T20:00:00+01:00";
const PERFORMANCE_DURATION_MS = 45_000;
const TOTAL_DURATION_MS = PERFORMANCE_DURATION_MS + 11_000;

const DEMO_ACTS: DemoAct[] = [
  {
    replayId: "70000000-0000-4000-8000-000000000101",
    performanceId: "70000000-0000-4000-8000-000000000201",
    bandId: "70000000-0000-4000-8000-000000000301",
    songId: "70000000-0000-4000-8000-000000000401",
    profileId: "70000000-0000-4000-8000-000000000501",
    bandName: "Neon Avenue",
    songTitle: "Satellite Hearts",
    genre: "pop",
    rank: 1,
    stage: "main_stage",
    role: "lead vocalist",
    vocalRole: "lead vocals",
    audienceReaction: 6,
  },
  {
    replayId: "70000000-0000-4000-8000-000000000102",
    performanceId: "70000000-0000-4000-8000-000000000202",
    bandId: "70000000-0000-4000-8000-000000000302",
    songId: "70000000-0000-4000-8000-000000000402",
    profileId: "70000000-0000-4000-8000-000000000502",
    bandName: "Static Youth",
    songTitle: "No Surrender",
    genre: "rock",
    rank: 7,
    stage: "rock_stage",
    role: "guitarist",
    instrumentRole: "electric guitar",
    audienceReaction: 5,
  },
  {
    replayId: "70000000-0000-4000-8000-000000000103",
    performanceId: "70000000-0000-4000-8000-000000000203",
    bandId: "70000000-0000-4000-8000-000000000303",
    songId: "70000000-0000-4000-8000-000000000403",
    profileId: "70000000-0000-4000-8000-000000000503",
    bandName: "Velvet Circuit",
    songTitle: "After Midnight",
    genre: "electronic",
    rank: 18,
    stage: "stage_b",
    role: "keyboard player",
    instrumentRole: "keyboard",
    audienceReaction: 3,
  },
  {
    replayId: "70000000-0000-4000-8000-000000000104",
    performanceId: "70000000-0000-4000-8000-000000000204",
    bandId: "70000000-0000-4000-8000-000000000304",
    songId: "70000000-0000-4000-8000-000000000404",
    profileId: "70000000-0000-4000-8000-000000000504",
    bandName: "Mara Vale",
    songTitle: "Paper Moons",
    genre: "acoustic singer songwriter",
    rank: 33,
    stage: "studio_floor",
    role: "singer songwriter",
    instrumentRole: "acoustic guitar",
    vocalRole: "lead vocals",
    audienceReaction: 2,
  },
];

export const TOTP_ADMIN_DEMO_REPLAYS: TotpBroadcastReplay[] = DEMO_ACTS.map((act, index) => {
  const runningOrder = index + 1;
  const presenterIntro = `At number ${act.rank} this week, please welcome ${act.bandName} performing ${act.songTitle}!`;
  const shots = buildTotpShotGrammar({
    genre: act.genre,
    energy: act.stage === "rock_stage" ? "high" : act.stage === "studio_floor" ? "low" : "medium",
    performerCount: act.stage === "stage_b" || act.stage === "studio_floor" ? 2 : 4,
  });
  const cues = buildTotpPerformanceTimeline({
    artistName: act.bandName,
    songTitle: act.songTitle,
    chartRank: act.rank,
    presenterIntro,
    stage: act.stage,
    performanceDurationMs: PERFORMANCE_DURATION_MS,
    shots,
    debut: index === 0,
    trendChange: index === 1 ? 3 : index === 2 ? -2 : null,
  });

  return {
    id: act.replayId,
    performance_id: act.performanceId,
    replay_version: 4,
    stage_key: act.stage,
    presenter_key: "alex_rayne",
    duration_ms: TOTAL_DURATION_MS,
    checksum: `admin-demo-${runningOrder}-totp`,
    generated_at: `${DEMO_DATE}T20:00:00+01:00`,
    payload: {
      schemaVersion: 1,
      episodeId: DEMO_EPISODE_ID,
      episodeNumber: 1,
      episodeDate: DEMO_DATE,
      broadcastAt: DEMO_BROADCAST_AT,
      performanceId: act.performanceId,
      runningOrder,
      presenterKey: "alex_rayne",
      presenterDisplayName: "Alex Rayne",
      showVariant: "regular",
      liveTv: { audienceReaction: act.audienceReaction },
      band: {
        id: act.bandId,
        name: act.bandName,
        members: [
          {
            profile_id: act.profileId,
            display_name: `${act.bandName} performer`,
            role: act.role,
            instrument_role: act.instrumentRole ?? null,
            vocal_role: act.vocalRole ?? null,
            visual_snapshot: {
              appearance: defaultAppearance(act.profileId),
              legacyAvatar: null,
              richClothing: [],
            },
          },
        ],
      },
      song: {
        id: act.songId,
        title: act.songTitle,
        genre: act.genre,
        qualifyingRank: act.rank,
      },
      stage: act.stage,
      performanceDurationMs: PERFORMANCE_DURATION_MS,
      totalDurationMs: TOTAL_DURATION_MS,
      cues,
    },
  };
});

export function TotpAdminDemo() {
  return (
    <Card className="border-fuchsia-500/30" data-totp-admin-demo>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MonitorPlay className="h-5 w-5 text-fuchsia-500" /> TOTP television studio demo
            </CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              Always-available production preview using the real 3D television renderer, presenter direction, audience system, four performance zones and programme intro. It does not require a live episode.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">synthetic fixture</Badge>
            <Badge variant="secondary">4 stages</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div><strong>Safe preview.</strong> No invitations, chart positions, fame, cash, achievements, social posts, episode state or archive rows are created or changed.</div>
          </div>
          <div className="flex gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div><strong>Browser audio policy.</strong> If the supplied programme intro cannot autoplay with sound, use the Start intro button shown over the video.</div>
          </div>
        </div>
        <TotpFullEpisodePlayer replays={TOTP_ADMIN_DEMO_REPLAYS} />
      </CardContent>
    </Card>
  );
}

export default TotpAdminDemo;
