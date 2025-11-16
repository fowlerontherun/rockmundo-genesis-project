import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AudioUpload } from "@/components/media/AudioUpload";
import { VideoUpload } from "@/components/media/VideoUpload";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  fetchBucketUsage,
  type StorageUsageSummary,
} from "@/integrations/supabase/storage";
import { useToast } from "@/components/ui/use-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Brain,
  CalendarDays,
  CheckCircle2,
  Loader2,
  LucideIcon,
  Megaphone,
  Mic2,
  RefreshCw,
  Sparkles,
  Video,
} from "lucide-react";

const AUDIO_BUCKET = "music";
const VIDEO_BUCKET = "social-posts";

interface PipelineStage {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  actionItems: string[];
  successMetrics: string[];
}

const pipelineStages: PipelineStage[] = [
  {
    id: "ideation",
    label: "Ideation",
    description: "Shape the creative direction and align your content pillars for the campaign.",
    icon: Sparkles,
    actionItems: [
      "Collect backstage clips and demo snippets",
      "Outline storyline beats for the hero video",
      "Confirm release window with the label team",
    ],
    successMetrics: [
      "Creative brief approved",
      "Shot list confirmed",
      "Campaign moodboard shared",
    ],
  },
  {
    id: "production",
    label: "Production",
    description: "Record, edit, and polish assets across audio, video, and social formats.",
    icon: Video,
    actionItems: [
      "Finalize mix & master for lead single",
      "Cut 30s teaser and 10s hooks",
      "Render vertical clips for socials",
    ],
    successMetrics: [
      "All assets tagged with metadata",
      "Review approvals from stakeholders",
      "QA pass for captions & subtitles",
    ],
  },
  {
    id: "launch",
    label: "Launch",
    description: "Distribute to platforms, schedule go-live moments, and prep community responses.",
    icon: Megaphone,
    actionItems: [
      "Schedule premiere on streaming apps",
      "Coordinate influencer shout-outs",
      "Draft announcement copy",
    ],
    successMetrics: [
      "Release timeline locked",
      "All pre-saves activated",
      "Support team briefed",
    ],
  },
  {
    id: "review",
    label: "Review",
    description: "Measure performance, recap insights, and archive learnings for the next drop.",
    icon: CalendarDays,
    actionItems: [
      "Collect first-week analytics",
      "Highlight fan reactions for socials",
      "Update evergreen content backlog",
    ],
    successMetrics: [
      "KPI dashboard exported",
      "Debrief shared with crew",
      "Top-performing assets tagged",
    ],
  },
];

const publishingChecklist = [
  {
    title: "Release Day Assets",
    description: "Hero video, thumbnail set, and short clips delivered and approved.",
    status: "Scheduled",
  },
  {
    title: "Press Outreach",
    description: "Press kit shared with media partners and influencers.",
    status: "In Review",
  },
  {
    title: "Fan Club Drop",
    description: "Exclusive behind-the-scenes audio uploaded for superfans.",
    status: "Ready",
  },
];

type ClipReviewDecision = "pending" | "accepted" | "rejected";

interface ClipReviewDraft {
  mixRating: number;
  hookRating: number;
  decision: ClipReviewDecision;
  notes: string;
  submittedAt?: string;
}

interface AIClipSubmission {
  id: string;
  title: string;
  promptSummary: string;
  promptFeatures: {
    tempo: string;
    mood: string;
    instruments: string[];
    palette: string;
    length: string;
  };
  aiHighlights: string[];
  versionTag: string;
  waveformFocus: string;
  referenceUseCase: string;
  reinforcementHints: string[];
  previousReview?: ClipReviewDraft;
}

const aiClipQueue: AIClipSubmission[] = [
  {
    id: "clip-sunrise-riot",
    title: "Sunrise Riot Hook",
    promptSummary:
      "128 BPM hype build that layers analog arps, distorted bass, and gated vocals for pre-chorus lifts.",
    promptFeatures: {
      tempo: "128 BPM",
      mood: "Triumphant sprint",
      instruments: ["Analog arp", "Distorted bass", "Vocal chops"],
      palette: "Neon chrome",
      length: "0:18",
    },
    aiHighlights: [
      "Auto-sliced vocal shots land on downbeats",
      "Transient designer keeps drums crisp on mobile",
      "Sidechain curve tied to crowd chant automation",
    ],
    versionTag: "v7.1",
    waveformFocus: "LUFS -7.8 / Crest factor 9.4 dB",
    referenceUseCase: "TikTok chorus teaser + tour opener montage",
    reinforcementHints: ["Keep 120-130 BPM leads", "Emphasize gated vocal chops"],
  },
  {
    id: "clip-midnight-parade",
    title: "Midnight Parade",
    promptSummary:
      "98 BPM halftime groove featuring clean guitars, string swells, and analog pads for reflective story beats.",
    promptFeatures: {
      tempo: "98 BPM",
      mood: "Lush cinematic",
      instruments: ["Clean guitar", "String ensemble", "Analog pad"],
      palette: "Film grain",
      length: "0:26",
    },
    aiHighlights: [
      "Stereo guitar double tracked with auto-align",
      "Noisy tape tail used to bridge into narration",
      "Adaptive string dynamics follow dialogue ducking",
    ],
    versionTag: "v3.4",
    waveformFocus: "LUFS -12.1 / Crest factor 13.2 dB",
    referenceUseCase: "Documentary recap + recap carousel",
    reinforcementHints: ["Feature organic strings on reflective prompts", "Allow tape hiss for authenticity"],
    previousReview: {
      mixRating: 4,
      hookRating: 4,
      decision: "accepted",
      notes: "Lock string swell at 0:14 for final cut.",
      submittedAt: new Date().toISOString(),
    },
  },
  {
    id: "clip-nightdrive",
    title: "Nightdrive Voltage",
    promptSummary:
      "144 BPM darkwave pulse with hybrid drum kit, FM bass growls, and metallic percussion for esports trailers.",
    promptFeatures: {
      tempo: "144 BPM",
      mood: "Aggressive adrenaline",
      instruments: ["FM bass", "Hybrid drums", "Metal perc"],
      palette: "Infrared",
      length: "0:22",
    },
    aiHighlights: [
      "Bass growl synced to stutter edit moments",
      "Reverse cymbal cues tied to camera whip markers",
      "Noise riser hits match sponsor reveal beat",
    ],
    versionTag: "v5.0",
    waveformFocus: "LUFS -6.3 / Crest factor 7.1 dB",
    referenceUseCase: "Esports trailer drop + merch teaser",
    reinforcementHints: ["Lean into FM bass syncopation", "Preserve metallic percussion swing"],
    previousReview: {
      mixRating: 3,
      hookRating: 5,
      decision: "accepted",
      notes: "Need alternate ending without vocal stab.",
      submittedAt: new Date().toISOString(),
    },
  },
];

const ratingLabels: Record<number, string> = {
  1: "Misses the vibe",
  2: "Needs heavy edits",
  3: "Usable with tweaks",
  4: "Release-ready",
  5: "Signature moment",
};

interface FeatureAggregate {
  feature: string;
  avgScore: number;
  acceptanceRate: number;
  submissions: number;
}

const createDefaultReview = (): ClipReviewDraft => ({
  mixRating: 3,
  hookRating: 3,
  decision: "pending",
  notes: "",
});

const decisionStyles: Record<ClipReviewDecision, string> = {
  pending: "border-dashed border-muted-foreground/40 text-muted-foreground",
  accepted: "border-emerald-500/30 text-emerald-600 bg-emerald-500/10",
  rejected: "border-rose-500/30 text-rose-600 bg-rose-500/10",
};

const decisionLabels: Record<ClipReviewDecision, string> = {
  pending: "Needs review",
  accepted: "Accepted",
  rejected: "Rejected",
};

interface FeatureMapStats {
  totalScore: number;
  acceptedCount: number;
  count: number;
}

const pushFeatureStat = (
  map: Map<string, FeatureMapStats>,
  feature: string,
  avgScore: number,
  accepted: boolean,
) => {
  const entry = map.get(feature) ?? { totalScore: 0, acceptedCount: 0, count: 0 };
  entry.totalScore += avgScore;
  entry.count += 1;
  if (accepted) entry.acceptedCount += 1;
  map.set(feature, entry);
};

const mapToAggregates = (map: Map<string, FeatureMapStats>): FeatureAggregate[] =>
  Array.from(map.entries())
    .map(([feature, stats]) => ({
      feature,
      avgScore: Number((stats.totalScore / stats.count).toFixed(2)),
      acceptanceRate: stats.count ? Number(((stats.acceptedCount / stats.count) * 100).toFixed(1)) : 0,
      submissions: stats.count,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

const getAverageScore = (review?: ClipReviewDraft) => {
  if (!review) return 0;
  return Number(((review.mixRating + review.hookRating) / 2).toFixed(2));
};

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const MediaStudio = () => {
  const [audioUsage, setAudioUsage] = useState<StorageUsageSummary | null>(null);
  const [videoUsage, setVideoUsage] = useState<StorageUsageSummary | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [loadingUsage, setLoadingUsage] = useState<boolean>(true);
  const { toast } = useToast();
  const [clipReviews, setClipReviews] = useState<Record<string, ClipReviewDraft>>(() => {
    const initial: Record<string, ClipReviewDraft> = {};
    for (const clip of aiClipQueue) {
      initial[clip.id] = clip.previousReview ? { ...clip.previousReview } : createDefaultReview();
    }
    return initial;
  });
  const [reinforcementStatus, setReinforcementStatus] = useState<"idle" | "syncing" | "ready">("idle");
  const [datasetStatus, setDatasetStatus] = useState<"idle" | "queued">("idle");
  const totalClips = aiClipQueue.length;

  const handleClipReviewChange = (clipId: string, partial: Partial<ClipReviewDraft>) => {
    setClipReviews((prev) => ({
      ...prev,
      [clipId]: { ...(prev[clipId] ?? createDefaultReview()), ...partial },
    }));
  };

  const handleReviewSubmit = (clipId: string) => {
    const clip = aiClipQueue.find((item) => item.id === clipId);
    if (!clip) return;
    const review = clipReviews[clipId] ?? createDefaultReview();
    const avgScore = getAverageScore(review);

    setClipReviews((prev) => ({
      ...prev,
      [clipId]: { ...(prev[clipId] ?? createDefaultReview()), submittedAt: new Date().toISOString() },
    }));

    toast({
      title: "Review saved",
      description: `${clip.title} marked as ${decisionLabels[review.decision]} (${avgScore.toFixed(2)})`,
    });
  };

  const featureAnalytics = useMemo(() => {
    const tempoMap = new Map<string, FeatureMapStats>();
    const moodMap = new Map<string, FeatureMapStats>();
    const instrumentMap = new Map<string, FeatureMapStats>();

    aiClipQueue.forEach((clip) => {
      const review = clipReviews[clip.id];
      if (!review) return;
      const avgScore = getAverageScore(review);
      const accepted = review.decision === "accepted";

      pushFeatureStat(tempoMap, clip.promptFeatures.tempo, avgScore, accepted);
      pushFeatureStat(moodMap, clip.promptFeatures.mood, avgScore, accepted);
      clip.promptFeatures.instruments.forEach((instrument) =>
        pushFeatureStat(instrumentMap, instrument, avgScore, accepted),
      );
    });

    return {
      tempo: mapToAggregates(tempoMap),
      mood: mapToAggregates(moodMap),
      instruments: mapToAggregates(instrumentMap),
    };
  }, [clipReviews]);

  const promptPairInsights = useMemo(
    () =>
      aiClipQueue
        .map((clip) => ({
          clip,
          review: clipReviews[clip.id],
          avgScore: getAverageScore(clipReviews[clip.id]),
        }))
        .sort((a, b) => b.avgScore - a.avgScore),
    [clipReviews],
  );

  const reviewCompletion = useMemo(
    () => Object.values(clipReviews).filter((review) => Boolean(review?.submittedAt)).length,
    [clipReviews],
  );

  const averageReviewScore = useMemo(() => {
    const entries = Object.values(clipReviews);
    if (!entries.length) return 0;
    const sum = entries.reduce((acc, review) => acc + getAverageScore(review), 0);
    return Number((sum / entries.length).toFixed(2));
  }, [clipReviews]);

  const highScoringClips = useMemo(
    () =>
      aiClipQueue.filter((clip) => {
        const review = clipReviews[clip.id];
        if (!review) return false;
        return review.decision === "accepted" && getAverageScore(review) >= 4;
      }),
    [clipReviews],
  );

  const heuristicsFromAccepted = useMemo(() => {
    const hints = new Set<string>();
    highScoringClips.forEach((clip) => {
      clip.reinforcementHints.forEach((hint) => hints.add(hint));
    });
    return Array.from(hints);
  }, [highScoringClips]);

  const handleSyncHeuristics = () => {
    if (!highScoringClips.length) {
      toast({
        title: "Select clips first",
        description: "Mark at least one clip as accepted with a 4.0+ average score.",
        variant: "destructive",
      });
      return;
    }

    setReinforcementStatus("syncing");
    setTimeout(() => {
      setReinforcementStatus("ready");
      toast({
        title: "Prompt heuristics updated",
        description: `Fed ${highScoringClips.length} hero clips back into generation priorities.`,
      });
    }, 900);
  };

  const handleQueueFineTune = () => {
    if (!highScoringClips.length) {
      toast({
        title: "No clips queued",
        description: "Accept a few clips before exporting a fine-tune dataset.",
        variant: "destructive",
      });
      return;
    }

    setDatasetStatus("queued");
    toast({
      title: "Dataset export scheduled",
      description: `${highScoringClips.length} clips tagged for reinforcement learning batches.`,
    });
  };

  const combinedUsageError = useMemo(() => {
    return [audioUsage?.error, videoUsage?.error].filter(Boolean).join(" ") || null;
  }, [audioUsage?.error, videoUsage?.error]);

  useEffect(() => {
    if (!combinedUsageError) return;
    toast({
      title: "Storage insights unavailable",
      description: combinedUsageError,
      variant: "destructive",
    });
  }, [combinedUsageError, toast]);

  const loadUsage = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoadingUsage(true);
      }

      try {
        const [audio, video] = await Promise.all([
          fetchBucketUsage(AUDIO_BUCKET),
          fetchBucketUsage(VIDEO_BUCKET),
        ]);

        setAudioUsage(audio);
        setVideoUsage(video);
        setUsageError([audio.error, video.error].filter(Boolean).join(" ") || null);
      } finally {
        if (showLoader) {
          setLoadingUsage(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  useEffect(() => {
    setUsageError(combinedUsageError);
  }, [combinedUsageError]);

  const handleAssetUploaded = useCallback(() => {
    loadUsage(false);
  }, [loadUsage]);

  const renderUsageBlock = (usage: StorageUsageSummary | null, label: string) => {
    const breakdownEntries = Object.entries(usage?.contentTypeBreakdown ?? {})
      .sort(([, a], [, b]) => b.bytes - a.bytes)
      .slice(0, 3);

    return (
      <div className="rounded-lg border bg-muted/40 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground">
              {usage ? `Bucket: ${usage.bucketId}` : "Loading usage details"}
            </p>
          </div>
          <Badge variant="outline">{usage?.fileCount ?? 0} files</Badge>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total size</p>
            <p className="text-lg font-semibold">
              {usage ? formatBytes(usage.totalBytes) : loadingUsage ? "Updating…" : "0 B"}
            </p>
          </div>

          {breakdownEntries.length > 0 ? (
            <div className="space-y-1">
              {breakdownEntries.map(([contentType, data]) => (
                <div key={contentType} className="flex items-center justify-between text-xs">
                  <span className="truncate text-muted-foreground">{contentType}</span>
                  <span className="font-medium">{formatBytes(data.bytes)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {usage?.error ? usage.error : "Upload media to populate insights."}
            </p>
          )}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          {usage?.lastUpdatedAt
            ? `Last change ${new Date(usage.lastUpdatedAt).toLocaleString()}`
            : "Waiting for first upload"}
        </p>
      </div>
    );
  };

  return (
    <div className="container mx-auto space-y-8 py-10">
      <header className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mic2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Media Studio</h1>
            <p className="text-muted-foreground">
              Plan campaigns, sync creative assets, and monitor storage health before publishing day hits.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Mic2 className="h-3 w-3" /> Audio masters synced
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Video className="h-3 w-3" /> Promo cuts queued
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Megaphone className="h-3 w-3" /> Release strategy aligned
          </Badge>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/release-manager">Build release plan</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/social">Schedule social rollout</Link>
          </Button>
        </div>
      </header>

      {usageError && (
        <Alert variant="destructive">
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>{usageError}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <AudioUpload bucketId={AUDIO_BUCKET} onUploaded={handleAssetUploaded} />
        <VideoUpload bucketId={VIDEO_BUCKET} onUploaded={handleAssetUploaded} />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Storage insights</CardTitle>
            <CardDescription>Monitor available space and understand what file types dominate your library.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {renderUsageBlock(audioUsage, "Audio Library")}
            {renderUsageBlock(videoUsage, "Video Vault")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Publishing checklist</CardTitle>
            <CardDescription>Quick view of what needs a final nudge before the release.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {publishingChecklist.map((item) => (
              <div key={item.title} className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="secondary" asChild className="w-full">
              <Link to="/recording-studio">Jump to studio schedule</Link>
            </Button>
          </CardFooter>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>AI clip review board</CardTitle>
                <CardDescription>
                  Capture qualitative ratings, narrative notes, and approvals before clips reach the release calendar.
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{reviewCompletion}/{totalClips}</p>
                <p className="text-xs text-muted-foreground">clips logged</p>
                <p className="text-xs text-muted-foreground">Avg score {averageReviewScore.toFixed(2)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {aiClipQueue.map((clip) => {
              const review = clipReviews[clip.id];
              const avgScore = getAverageScore(review);
              const decision = review?.decision ?? "pending";

              return (
                <div key={clip.id} className="space-y-4 rounded-lg border bg-card/40 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{clip.title}</h3>
                        <Badge variant="outline">{clip.versionTag}</Badge>
                        <Badge className={`border ${decisionStyles[decision]}`}>
                          {decisionLabels[decision]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{clip.promptSummary}</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">{clip.promptFeatures.tempo}</Badge>
                        <Badge variant="secondary">{clip.promptFeatures.mood}</Badge>
                        <Badge variant="secondary">{clip.promptFeatures.palette}</Badge>
                        <Badge variant="outline">{clip.promptFeatures.length}</Badge>
                        {clip.promptFeatures.instruments.map((instrument) => (
                          <Badge key={instrument} variant="outline">
                            {instrument}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>{clip.waveformFocus}</p>
                        <p>{clip.referenceUseCase}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          AI highlights
                        </p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                          {clip.aiHighlights.map((highlight) => (
                            <li key={highlight}>{highlight}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <p className="text-xs uppercase text-muted-foreground">Average score</p>
                      <p className="text-3xl font-bold">{avgScore.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {review?.submittedAt
                          ? `Logged ${new Date(review.submittedAt).toLocaleString()}`
                          : "Not logged"}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span>Mix polish</span>
                        <span>{review?.mixRating ?? 0}/5</span>
                      </div>
                      <Slider
                        min={1}
                        max={5}
                        step={1}
                        value={[review?.mixRating ?? 3]}
                        onValueChange={(value) =>
                          handleClipReviewChange(clip.id, { mixRating: value[0] ?? review?.mixRating ?? 3 })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {ratingLabels[review?.mixRating ?? 3]}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span>Hook strength</span>
                        <span>{review?.hookRating ?? 0}/5</span>
                      </div>
                      <Slider
                        min={1}
                        max={5}
                        step={1}
                        value={[review?.hookRating ?? 3]}
                        onValueChange={(value) =>
                          handleClipReviewChange(clip.id, { hookRating: value[0] ?? review?.hookRating ?? 3 })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {ratingLabels[review?.hookRating ?? 3]}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Approval</p>
                      <RadioGroup
                        className="flex flex-wrap gap-4"
                        value={decision}
                        onValueChange={(value: ClipReviewDecision) =>
                          handleClipReviewChange(clip.id, { decision: value })
                        }
                      >
                        {(["accepted", "pending", "rejected"] as ClipReviewDecision[]).map((option) => (
                          <div key={option} className="flex items-center gap-2">
                            <RadioGroupItem value={option} id={`${clip.id}-${option}`} />
                            <Label htmlFor={`${clip.id}-${option}`} className="text-sm">
                              {decisionLabels[option]}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <Textarea
                      value={review?.notes ?? ""}
                      onChange={(event) => handleClipReviewChange(clip.id, { notes: event.target.value })}
                      placeholder={`Notes, edits, or context for ${clip.title}`}
                      className="flex-1"
                    />
                    <Button className="md:w-auto" onClick={() => handleReviewSubmit(clip.id)}>
                      Log review
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Prompt performance analytics</CardTitle>
            <CardDescription>
              Correlate tempo, instrumentation, and mood choices with reviewer sentiment before updating prompts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-semibold">Tempo cohorts</p>
                  <p className="text-muted-foreground">Avg score vs. BPM</p>
                </div>
                <div className="h-64">
                  {featureAnalytics.tempo.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={featureAnalytics.tempo}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="feature" />
                        <YAxis domain={[0, 5]} />
                        <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} avg score`, "Tempo"]} />
                        <Bar dataKey="avgScore" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                      Log at least one review to unlock tempo analytics.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-semibold">Mood acceptance</p>
                  <p className="text-muted-foreground">Top performing vibes</p>
                </div>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mood</TableHead>
                        <TableHead className="text-right">Avg score</TableHead>
                        <TableHead className="text-right">Acceptance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {featureAnalytics.mood.length ? (
                        featureAnalytics.mood.slice(0, 4).map((mood) => (
                          <TableRow key={mood.feature}>
                            <TableCell>{mood.feature}</TableCell>
                            <TableCell className="text-right">{mood.avgScore.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{mood.acceptanceRate.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                            Waiting for first mood review.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold">Instrument focus</p>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instrument</TableHead>
                      <TableHead className="text-right">Avg score</TableHead>
                      <TableHead className="text-right">Acceptance</TableHead>
                      <TableHead className="text-right">Submissions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {featureAnalytics.instruments.length ? (
                      featureAnalytics.instruments.slice(0, 5).map((instrument) => (
                        <TableRow key={instrument.feature}>
                          <TableCell>{instrument.feature}</TableCell>
                          <TableCell className="text-right">{instrument.avgScore.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{instrument.acceptanceRate.toFixed(1)}%</TableCell>
                          <TableCell className="text-right">{instrument.submissions}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                          Provide at least one rating to compare instrumentation choices.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold">Prompt pairings</p>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Clip</TableHead>
                      <TableHead>Tempo</TableHead>
                      <TableHead>Mood</TableHead>
                      <TableHead>Avg score</TableHead>
                      <TableHead>Decision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promptPairInsights.map(({ clip, review, avgScore }) => (
                      <TableRow key={clip.id}>
                        <TableCell className="font-medium">{clip.title}</TableCell>
                        <TableCell>{clip.promptFeatures.tempo}</TableCell>
                        <TableCell>{clip.promptFeatures.mood}</TableCell>
                        <TableCell>{avgScore.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className={`border ${decisionStyles[review?.decision ?? "pending"]}`}>
                            {decisionLabels[review?.decision ?? "pending"]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Reinforcement & fine-tuning hooks</CardTitle>
            <CardDescription>Push the best clips back into heuristic prompts or export a dataset for model tuning.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  High-scoring clips
                </p>
                <p className="text-3xl font-bold">{highScoringClips.length}</p>
                <p className="text-xs text-muted-foreground">
                  Accepted clips with ≥4.0 score are eligible for reinforcement
                </p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Emerging heuristics
                </p>
                {heuristicsFromAccepted.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {heuristicsFromAccepted.map((hint) => (
                      <li key={hint} className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        {hint}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Log accepted clips to surface heuristics.</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSyncHeuristics} disabled={reinforcementStatus === "syncing"}>
                {reinforcementStatus === "syncing" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Update prompt heuristics
              </Button>
              <Button variant="outline" onClick={handleQueueFineTune} disabled={datasetStatus === "queued"}>
                {datasetStatus === "queued" ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="mr-2 h-4 w-4" />
                )}
                Queue fine-tune dataset
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Once synced, heuristics boost prompt weighting immediately while the dataset export feeds the next scheduled
              training window.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle>Campaign pipeline</CardTitle>
            <CardDescription>Select a stage to see the checklist and success measures.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={pipelineStages[0]?.id} className="w-full">
              <TabsList className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {pipelineStages.map((stage) => (
                  <TabsTrigger key={stage.id} value={stage.id} className="flex items-center gap-2 text-left">
                    <stage.icon className="h-4 w-4" />
                    <span>{stage.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {pipelineStages.map((stage) => (
                <TabsContent key={stage.id} value={stage.id} className="mt-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase text-muted-foreground">Action items</h3>
                      <ul className="space-y-2 text-sm">
                        {stage.actionItems.map((action) => (
                          <li key={action} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase text-muted-foreground">Success metrics</h3>
                      <ul className="space-y-2 text-sm">
                        {stage.successMetrics.map((metric) => (
                          <li key={metric} className="flex items-start gap-2">
                            <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                            <span>{metric}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default MediaStudio;
