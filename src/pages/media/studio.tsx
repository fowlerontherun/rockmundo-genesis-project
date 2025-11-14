import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AudioUpload } from "@/components/media/AudioUpload";
import { VideoUpload } from "@/components/media/VideoUpload";
import {
  fetchBucketUsage,
  type StorageUsageSummary,
} from "@/integrations/supabase/storage";
import { useToast } from "@/components/ui/use-toast";
import {
  CalendarDays,
  CheckCircle2,
  LucideIcon,
  Megaphone,
  Mic2,
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
