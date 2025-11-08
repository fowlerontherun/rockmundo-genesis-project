import { useMemo, useState } from "react";
import {
  BarChart,
  Calendar,
  Flame,
  Globe2,
  Layers,
  Radio,
  Rocket,
  Sparkles,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import {
  dikcokArchivedClassics,
  dikcokBands,
  dikcokChallenges,
  dikcokFanMissions,
  dikcokForecasts,
  dikcokGeoTrends,
  dikcokGuilds,
  dikcokPolls,
  dikcokPremieres,
  dikcokRadio,
  dikcokStoryChains,
  dikcokTracks,
  dikcokTrendVideos,
  dikcokVideoTypes,
} from "@/data/dikcok";
import type { PlayerProfile } from "@/hooks/useGameData";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface DikCokExperienceProps {
  profile: PlayerProfile;
}

type FeedFilter = "ForYou" | "Trending" | "FanFavorites" | "Friends";

const feedFilters: { value: FeedFilter; label: string; description: string }[] = [
  {
    value: "ForYou",
    label: "For You",
    description: "Personalized blend of hype velocity, preferences, and missions",
  },
  {
    value: "Trending",
    label: "Trending",
    description: "Fast-rising videos dominating challenge leaderboards",
  },
  {
    value: "FanFavorites",
    label: "Fan Favorites",
    description: "Community-curated gems with high tip volume",
  },
  {
    value: "Friends",
    label: "Friends",
    description: "Guild members and crew you follow closely",
  },
];

const expansionFeatures: Array<{ title: string; description: string; tags: string[] }> = [
  {
    title: "Co-op Duet Mode",
    description:
      "Pair any clip with an existing video using synchronized audio alignment, split layouts, and shared hype pools.",
    tags: ["Duets", "Collaboration"],
  },
  {
    title: "Live Premieres",
    description:
      "Bands can schedule premiere windows with countdown overlays, exclusive templates, and spike forecasting dashboards.",
    tags: ["Events", "Bands"],
  },
  {
    title: "Augmented Reality Filters",
    description:
      "Unlock branded AR personas, reactive lighting rigs, and motion-tracked effects tied to fan missions or purchases.",
    tags: ["AR", "Creator Packs"],
  },
  {
    title: "Interactive Polls",
    description:
      "Embed tappable polls inside videos. Results feed into analytics and reward bonus hype when participation milestones hit.",
    tags: ["Engagement", "Analytics"],
  },
  {
    title: "Story Chains",
    description:
      "Multi-episode narratives that pass from creator to creator, awarding guild streak bonuses for completion.",
    tags: ["Narrative", "Guilds"],
  },
  {
    title: "Beat Challenges",
    description:
      "Tempo-aware rhythm mini-games layered on top of tracks. Viewers compete for leaderboards and tip boosts.",
    tags: ["Mini-game", "Rhythm"],
  },
  {
    title: "Fan Missions",
    description:
      "Goal-driven quests from bands that unlock exclusive stems, merch, or cosmetic drops for participating fans.",
    tags: ["Community", "Rewards"],
  },
  {
    title: "Creator Guilds",
    description:
      "Form teams with shared resource pools, research trees, and collaborative challenge objectives.",
    tags: ["Guilds", "Social"],
  },
  {
    title: "Producer Mode",
    description:
      "Bands remix top-performing clips into official compilations with automated rights clearance and attribution.",
    tags: ["Bands", "Remix"],
  },
  {
    title: "Hype Forecasting",
    description:
      "Predict trend trajectories, stake in-game currency, and earn analytics badges for accurate calls.",
    tags: ["Economy", "Analytics"],
  },
  {
    title: "Virtual Concert Teasers",
    description:
      "Exclusive teaser templates with 3D stage previews, seat heatmaps, and cross-promotion hooks to ticket sales.",
    tags: ["Events", "Marketing"],
  },
  {
    title: "Music Discovery Radio",
    description:
      "Auto-play carousel focused on tracks primed for content creation with one-tap Create buttons.",
    tags: ["Discovery", "Audio"],
  },
  {
    title: "Behind-the-Scenes Clips",
    description:
      "Premium pass holders access private studio diaries, rehearsal breakdowns, and wellness routines.",
    tags: ["Premium", "Lore"],
  },
  {
    title: "Cross-Game Challenges",
    description:
      "Link DikCok goals with gigs, busking, or touring for layered XP and cosmetic rewards.",
    tags: ["Cross-mode", "Progression"],
  },
  {
    title: "Creator Education Hub",
    description:
      "Interactive lessons, mentor breakdowns, and practice templates for leveling up production quality.",
    tags: ["Education", "Skills"],
  },
  {
    title: "Fan Remix Tools",
    description:
      "Lightweight DAW inside the uploader enabling tempo shifts, loop slicing, and one-touch mastering.",
    tags: ["Remix", "Tools"],
  },
  {
    title: "Geo-Trends Map",
    description:
      "Heatmap overview of regional opportunities with recommendations on when and how to post.",
    tags: ["Analytics", "Targeting"],
  },
  {
    title: "Sponsored Trends",
    description:
      "Branded takeovers with custom templates, product placements, and guaranteed placement budgets.",
    tags: ["Monetization", "Events"],
  },
  {
    title: "AI-Powered Editing",
    description:
      "Machine learning identifies optimal cuts, transitions, and posting windows based on historical performance.",
    tags: ["AI", "Editing"],
  },
  {
    title: "Archived Classics",
    description:
      "Library of legendary clips with remix permissions and historical analytics for inspiration.",
    tags: ["Archive", "Heritage"],
  },
];

const bandById = Object.fromEntries(dikcokBands.map((band) => [band.id, band]));
const tracksByBand = dikcokTracks.reduce<Record<string, typeof dikcokTracks>>((acc, track) => {
  acc[track.bandId] = acc[track.bandId] || [];
  acc[track.bandId].push(track);
  return acc;
}, {});

export const DikCokExperience = ({ profile }: DikCokExperienceProps) => {
  const [selectedFeed, setSelectedFeed] = useState<FeedFilter>("ForYou");
  const [selectedVideoTypeId, setSelectedVideoTypeId] = useState<string>(
    dikcokVideoTypes[0]?.id ?? ""
  );
  const defaultBandId = dikcokBands[0]?.id ?? "";
  const defaultTracks = tracksByBand[defaultBandId] ?? [];
  const [selectedBandId, setSelectedBandId] = useState<string>(defaultBandId);
  const [selectedTrackId, setSelectedTrackId] = useState<string>(
    defaultTracks[0]?.id ?? ""
  );

  const bandTracks = useMemo(() => tracksByBand[selectedBandId] ?? [], [selectedBandId]);

  const selectedVideoType = useMemo(
    () => dikcokVideoTypes.find((type) => type.id === selectedVideoTypeId),
    [selectedVideoTypeId]
  );

  const selectedBand = bandById[selectedBandId];
  const selectedTrack = useMemo(
    () => bandTracks.find((track) => track.id === selectedTrackId) ?? bandTracks[0],
    [bandTracks, selectedTrackId]
  );

  const filteredTrendVideos = useMemo(
    () =>
      dikcokTrendVideos.filter((video) => video.bestForFeeds.includes(selectedFeed)),
    [selectedFeed]
  );

  const hypeScore = useMemo(() => {
    const baseHype = selectedBand?.hype ?? 0;
    const videoMultiplier = selectedVideoType?.difficulty === "Advanced" ? 1.2 : 1;
    const trackBonus = (selectedTrack?.popularityScore ?? 0) / 100;
    return Math.round(baseHype * videoMultiplier * (1 + trackBonus * 0.35));
  }, [selectedBand, selectedVideoType, selectedTrack]);

  const fameTierColor = {
    Bronze: "bg-orange-500/10 text-orange-400",
    Silver: "bg-slate-500/10 text-slate-300",
    Gold: "bg-yellow-500/10 text-yellow-400",
    Platinum: "bg-blue-500/10 text-blue-300",
    Diamond: "bg-cyan-500/10 text-cyan-300",
  } as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">DikCok Studio</h2>
          <p className="text-muted-foreground">
            Craft viral clips, amplify band partners, and convert hype into lasting fans.
          </p>
        </div>
        <Badge variant="outline" className="gap-2 text-sm">
          <Sparkles className="h-4 w-4" /> Creator Tier: {profile.username ?? profile.display_name ?? "Unknown"}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" /> Hype Potential
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{hypeScore.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Calculated from band momentum, track popularity, and video difficulty.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" /> Fan Conversion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">
              {selectedBand?.analytics.fanConversionRate ?? 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Higher rates unlock Creator Packs and premium revenue splits.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Rocket className="h-4 w-4 text-purple-500" /> Fame Trajectory
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge
              variant="secondary"
              className={cn("w-fit", fameTierColor[selectedBand?.fameTier ?? "Silver"])}
            >
              {selectedBand?.fameTier ?? "Silver"} momentum: {selectedBand?.momentum ?? "Rising"}
            </Badge>
            <Progress value={(selectedBand?.analytics.averageEngagement ?? 0) * 1.1} />
            <p className="text-xs text-muted-foreground">
              Maintain streaks with weekly trend participation and guild boosts.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Video className="h-5 w-5" /> Creation Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Video Types ({dikcokVideoTypes.length})
                  </h3>
                  <Badge variant="secondary">{selectedVideoType?.category ?? "Select"}</Badge>
                </div>
                <ScrollArea className="h-52 rounded-md border">
                  <div className="divide-y">
                    {dikcokVideoTypes.map((videoType) => (
                      <button
                        key={videoType.id}
                        onClick={() => setSelectedVideoTypeId(videoType.id)}
                        className={cn(
                          "w-full px-4 py-3 text-left transition",
                          selectedVideoTypeId === videoType.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{videoType.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {videoType.difficulty}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {videoType.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {selectedVideoType && (
                <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <Layers className="h-4 w-4" />
                    <span>Duration hint: {selectedVideoType.durationHint}</span>
                    <Separator orientation="vertical" className="h-4" />
                    <span>Unlock: {selectedVideoType.unlockRequirement}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedVideoType.signatureEffects.map((effect) => (
                      <Badge key={effect} variant="outline">
                        {effect}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Featured Bands
                </h3>
                <div className="mt-2 grid gap-2">
                  {dikcokBands.map((band) => (
                    <button
                      key={band.id}
                      onClick={() => {
                        setSelectedBandId(band.id);
                        const tracks = tracksByBand[band.id] ?? [];
                        setSelectedTrackId(tracks[0]?.id ?? "");
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-md border px-3 py-2 text-left transition",
                        selectedBandId === band.id
                          ? "border-primary bg-primary/10"
                          : "hover:bg-muted"
                      )}
                    >
                      <div>
                        <p className="font-medium">{band.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {band.genre} • {band.trendTag}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {band.analytics.videosCreated.toLocaleString()} vids
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Track Selection
                </h3>
                <div className="mt-2 space-y-2">
                  {bandTracks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      This band has no tracks available yet. Check back soon!
                    </p>
                  ) : (
                    bandTracks.map((track) => (
                      <HoverCard key={track.id}>
                        <HoverCardTrigger asChild>
                          <button
                            onClick={() => setSelectedTrackId(track.id)}
                            className={cn(
                              "w-full rounded-md border px-3 py-2 text-left transition",
                              selectedTrackId === track.id
                                ? "border-primary bg-primary/10"
                                : "hover:bg-muted"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{track.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {track.usage}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {track.genre} • {track.bpm} BPM • {track.mood}
                            </p>
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-72 text-xs">
                          <p>Popularity score: {track.popularityScore}/100</p>
                          <p>Featured in {track.featuredIn.toLocaleString()} videos</p>
                          {track.unlocks && track.unlocks.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="font-semibold">Unlocks:</p>
                              <ul className="list-disc pl-4">
                                {track.unlocks.map((unlock) => (
                                  <li key={unlock}>{unlock}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </HoverCardContent>
                      </HoverCard>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5" /> Trend & Challenge Control Center
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={selectedFeed} onValueChange={(value) => setSelectedFeed(value as FeedFilter)}>
            <TabsList className="flex flex-wrap">
              {feedFilters.map((filter) => (
                <TabsTrigger key={filter.value} value={filter.value} className="gap-2">
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {feedFilters.map((filter) => (
              <TabsContent key={filter.value} value={filter.value} className="pt-4">
                <p className="text-xs text-muted-foreground mb-4">
                  {filter.description}
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredTrendVideos.map((video) => {
                    const band = bandById[video.bandId];
                    return (
                      <Card key={video.id} className="border-muted">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center justify-between">
                            <span>{video.title}</span>
                            <Badge variant="outline">{video.engagementVelocity}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-xs text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Creator</span>
                            <span className="font-medium text-foreground">{video.creator}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Views</span>
                            <span className="font-medium text-foreground">{video.views.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Hype ➜ Fans</span>
                            <span className="font-medium text-foreground">
                              +{video.hypeGain} / +{video.fanGain}
                            </span>
                          </div>
                          {band && (
                            <div className="flex justify-between">
                              <span>Band</span>
                              <span className="font-medium text-foreground">{band.name}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>Tag</span>
                            <span className="font-medium text-primary">{video.trendingTag}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <Separator />

          <div className="grid gap-4 lg:grid-cols-3">
            {dikcokChallenges.map((challenge) => (
              <Card key={challenge.id} className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Calendar className="h-4 w-4" /> {challenge.name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{challenge.theme}</p>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-muted-foreground">
                  <div>
                    <p className="font-semibold uppercase tracking-wide text-foreground text-[11px]">
                      Requirements
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {challenge.requirements.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wide text-foreground text-[11px]">
                      Rewards
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {challenge.rewards.map((reward) => (
                        <li key={reward}>{reward}</li>
                      ))}
                    </ul>
                  </div>
                  {(challenge.sponsor || challenge.crossGameHook) && (
                    <div className="flex flex-col gap-1">
                      {challenge.sponsor && (
                        <Badge variant="outline" className="w-fit text-xs">
                          Sponsored by {challenge.sponsor}
                        </Badge>
                      )}
                      {challenge.crossGameHook && (
                        <p className="text-[11px] text-muted-foreground">
                          Cross-game bonus: {challenge.crossGameHook}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" /> Guilds, Missions & Story Chains
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Active Guilds
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {dikcokGuilds.map((guild) => (
                  <Card key={guild.id} className="bg-muted/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center justify-between">
                        {guild.name}
                        <Badge variant="outline">Rank #{guild.ranking}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                      <p>{guild.focus}</p>
                      <div className="flex justify-between">
                        <span>Members</span>
                        <span className="text-foreground font-medium">{guild.members}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Weekly Hype</span>
                        <span className="text-foreground font-medium">{guild.weeklyHype.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {guild.perks.map((perk) => (
                          <Badge key={perk} variant="secondary" className="text-[10px]">
                            {perk}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fan Missions
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {dikcokFanMissions.map((mission) => {
                  const band = bandById[mission.bandId];
                  return (
                    <Card key={mission.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center justify-between">
                          {band?.name ?? "Unknown Band"}
                          <Badge variant="outline">Until {mission.expiresAt}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs text-muted-foreground">
                        <p>{mission.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {mission.rewards.map((reward) => (
                            <Badge key={reward} variant="secondary" className="text-[10px]">
                              {reward}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Story Chains
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {dikcokStoryChains.map((chain) => (
                  <Card key={chain.id} className="border-muted">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">{chain.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                      <p>{chain.description}</p>
                      <div className="flex justify-between text-foreground">
                        <span>Episodes</span>
                        <span>
                          {chain.progress}/{chain.episodes}
                        </span>
                      </div>
                      <Progress value={(chain.progress / chain.episodes) * 100} className="h-2" />
                      <div className="flex flex-wrap gap-2">
                        {chain.rewards.map((reward) => (
                          <Badge key={reward} variant="outline" className="text-[10px]">
                            {reward}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Radio className="h-5 w-5" /> Music Discovery Radio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              {dikcokRadio.map((slot) => {
                const track = dikcokTracks.find((item) => item.id === slot.trackId);
                const band = track ? bandById[track.bandId] : undefined;
                return (
                  <div key={slot.id} className="rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center justify-between text-foreground">
                      <span className="font-medium">{track?.title ?? "Unknown Track"}</span>
                      <Badge variant="outline">{slot.mood}</Badge>
                    </div>
                    <p>
                      {band?.name ?? "Unknown Band"} • {track?.genre ?? ""}
                    </p>
                    <p className="text-[11px]">{slot.featureHook}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe2 className="h-5 w-5" /> Geo-Trends Map
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              {dikcokGeoTrends.map((trend) => (
                <div key={trend.region} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="font-medium text-foreground">{trend.region}</p>
                    <p>{trend.topTrend}</p>
                  </div>
                  <div className="text-right text-foreground">
                    <p className="font-semibold">+{trend.growth}%</p>
                    <p className="text-[11px] text-muted-foreground">{trend.opportunityTag}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart className="h-5 w-5" /> Hype Forecasting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              {dikcokForecasts.map((forecast) => (
                <div key={forecast.id} className="rounded-md border border-dashed p-3">
                  <div className="flex items-center justify-between text-foreground">
                    <span className="font-medium">{forecast.trendTag}</span>
                    <Badge variant="outline">{forecast.predictionWindow}</Badge>
                  </div>
                  <p>{forecast.projectedOutcome}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span>Confidence: {(forecast.confidence * 100).toFixed(0)}%</span>
                    <span>Stake: {forecast.wagerRange}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" /> Premieres & Polls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-muted-foreground">
              <div className="space-y-2">
                {dikcokPremieres.map((premiere) => {
                  const band = bandById[premiere.bandId];
                  return (
                    <div key={premiere.id} className="rounded-md border bg-muted/20 p-3">
                      <div className="flex items-center justify-between text-foreground">
                        <span className="font-medium">{premiere.title}</span>
                        <Badge variant="outline">{premiere.scheduledFor}</Badge>
                      </div>
                      <p>{band?.name ?? "Unknown Band"}</p>
                      <p className="text-[11px]">Template: {premiere.exclusiveTemplate}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {premiere.perks.map((perk) => (
                          <Badge key={perk} variant="secondary" className="text-[10px]">
                            {perk}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />

              <div className="space-y-2">
                {dikcokPolls.map((poll) => (
                  <div key={poll.id} className="rounded-md border border-dashed p-3">
                    <p className="font-medium text-foreground">{poll.question}</p>
                    <div className="mt-2 space-y-1">
                      {poll.options.map((option) => (
                        <div key={option} className="flex items-center justify-between text-[11px]">
                          <span>{option}</span>
                          <Badge variant="outline">Vote</Badge>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {poll.totalVotes.toLocaleString()} total votes
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5" /> Expansion Systems
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {expansionFeatures.map((feature, index) => (
              <AccordionItem key={feature.title} value={`feature-${index}`}>
                <AccordionTrigger className="text-left">
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-semibold text-sm">{feature.title}</span>
                    <div className="flex flex-wrap gap-2">
                      {feature.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {feature.description}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArchiveIcon /> Archive & Premium Access
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Archived Classics
            </h3>
            {dikcokArchivedClassics.map((classic) => (
              <div key={classic.id} className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-between text-foreground">
                  <span className="font-medium">{classic.title}</span>
                  <Badge variant="outline">{classic.remixOpensIn}</Badge>
                </div>
                <p>
                  {classic.originalCreator} • {classic.originalBand}
                </p>
                <p className="text-[11px]">{classic.season}</p>
              </div>
            ))}
          </div>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="font-semibold text-foreground">Premium Band Pass</h3>
              <p className="text-xs">
                Unlock behind-the-scenes clips, analytics drilldowns, and guaranteed placement boosts for partner bands.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">Advanced analytics</Badge>
                <Badge variant="secondary">Exclusive templates</Badge>
                <Badge variant="secondary">Priority moderation</Badge>
              </div>
              <Button size="sm" className="mt-3">
                View Premium Tiers
              </Button>
            </div>
            <div className="rounded-lg border border-dashed bg-muted/20 p-4">
              <h3 className="font-semibold text-foreground">Creator Economy Tools</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                <li>Fan tipping and hype token showers with analytics receipts.</li>
                <li>Sponsored trend budget planning with ROI simulations.</li>
                <li>Cross-post automations to twaater with teaser formatting.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ArchiveIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
  >
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
    <path d="M9 12h6" />
  </svg>
);

export default DikCokExperience;
