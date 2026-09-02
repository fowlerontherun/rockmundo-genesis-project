import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellOff,
  Clock,
  ExternalLink,
  Leaf,
  Loader2,
  Play,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveProfile } from "@/hooks/useActiveProfile";

import {
  useEducationVideoSubscriptions,
  useToggleEducationVideoSubscription,
} from "../hooks/useEducationVideoSubscriptions";
import { useEducationVideoPlaylists } from "../hooks/useEducationVideoPlaylists";
import { getCooldownStatus, useWatchVideo } from "../hooks/useWatchVideo";
import type { VideoResource } from "../types";

type DifficultyFilter = "all" | "1" | "2" | "3";
type DurationFilter = "all" | "short" | "medium" | "long";
type SortMode = "recommended" | "skill" | "difficulty" | "shortest";

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Intermediate",
  3: "Advanced",
};

const formatSkillName = (value: string) =>
  value
    .replace(/^instruments_/, "")
    .replace(/^genres_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const matchesDuration = (video: VideoResource, filter: DurationFilter) => {
  if (filter === "all") return true;
  if (video.durationMinutes == null) return false;
  if (filter === "short") return video.durationMinutes <= 15;
  if (filter === "medium") return video.durationMinutes >= 16 && video.durationMinutes <= 30;
  return video.durationMinutes > 30;
};

export const VideosTab = () => {
  const { profileId } = useActiveProfile();
  const { data, isLoading, isError, error } = useEducationVideoPlaylists();
  const subscriptions = useEducationVideoSubscriptions(profileId);
  const toggleSubscription = useToggleEducationVideoSubscription(profileId);
  const watchVideo = useWatchVideo();

  const [cooldownStatus, setCooldownStatus] = useState(() => getCooldownStatus(profileId));
  const [search, setSearch] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("all");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [duration, setDuration] = useState<DurationFilter>("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [followingOnly, setFollowingOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [visibleCount, setVisibleCount] = useState(24);

  useEffect(() => {
    setCooldownStatus(getCooldownStatus(profileId));
    const interval = window.setInterval(() => {
      setCooldownStatus(getCooldownStatus(profileId));
    }, 30000);
    return () => window.clearInterval(interval);
  }, [profileId]);

  useEffect(() => {
    if (watchVideo.isSuccess) setCooldownStatus(getCooldownStatus(profileId));
  }, [profileId, watchVideo.isSuccess]);

  const playlists = data ?? [];
  const allVideos = useMemo(() => {
    const byId = new Map<string, VideoResource>();
    for (const playlist of playlists) {
      for (const resource of playlist.resources) byId.set(resource.id, resource);
    }
    return Array.from(byId.values());
  }, [playlists]);

  const skillOptions = useMemo(() => {
    const labels = new Map<string, string>();
    for (const video of allVideos) {
      if (video.skillSlug) labels.set(video.skillSlug, video.skillName || formatSkillName(video.skillSlug));
    }
    return Array.from(labels.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allVideos]);

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const video of allVideos) {
      for (const tag of video.tags) {
        const normalized = tag.trim();
        if (!normalized) continue;
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 40)
      .map(([tag]) => tag);
  }, [allVideos]);

  const subscribedSkills = subscriptions.data ?? new Set<string>();
  const subscribedSkillOptions = skillOptions.filter((skill) => subscribedSkills.has(skill.slug));

  const filteredVideos = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const result = allVideos.filter((video) => {
      if (selectedSkill !== "all" && video.skillSlug !== selectedSkill) return false;
      if (difficulty !== "all" && video.difficulty !== Number(difficulty)) return false;
      if (!matchesDuration(video, duration)) return false;
      if (selectedTag !== "all" && !video.tags.some((tag) => tag === selectedTag)) return false;
      if (followingOnly && (!video.skillSlug || !subscribedSkills.has(video.skillSlug))) return false;

      if (normalizedSearch) {
        const haystack = [
          video.name,
          video.summary,
          video.skillName,
          video.channelName ?? "",
          video.format,
          ...video.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }

      return true;
    });

    return result.sort((a, b) => {
      if (sortMode === "skill") return a.skillName.localeCompare(b.skillName) || a.name.localeCompare(b.name);
      if (sortMode === "difficulty") return a.difficulty - b.difficulty || a.name.localeCompare(b.name);
      if (sortMode === "shortest") {
        return (a.durationMinutes ?? Number.MAX_SAFE_INTEGER) - (b.durationMinutes ?? Number.MAX_SAFE_INTEGER);
      }

      const aSubscribed = a.skillSlug ? subscribedSkills.has(a.skillSlug) : false;
      const bSubscribed = b.skillSlug ? subscribedSkills.has(b.skillSlug) : false;
      if (aSubscribed !== bSubscribed) return aSubscribed ? -1 : 1;
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.difficulty - b.difficulty || a.name.localeCompare(b.name);
    });
  }, [
    allVideos,
    difficulty,
    duration,
    followingOnly,
    search,
    selectedSkill,
    selectedTag,
    sortMode,
    subscribedSkills,
  ]);

  useEffect(() => {
    setVisibleCount(24);
  }, [search, selectedSkill, difficulty, duration, selectedTag, followingOnly, sortMode]);

  const filtersActive =
    Boolean(search.trim()) ||
    selectedSkill !== "all" ||
    difficulty !== "all" ||
    duration !== "all" ||
    selectedTag !== "all" ||
    followingOnly;

  const clearFilters = () => {
    setSearch("");
    setSelectedSkill("all");
    setDifficulty("all");
    setDuration("all");
    setSelectedTag("all");
    setFollowingOnly(false);
  };

  const formatTimeRemaining = () => {
    if (!cooldownStatus.cooldownEndsAt) return "";
    const minutes = Math.max(
      0,
      Math.ceil((cooldownStatus.cooldownEndsAt.getTime() - Date.now()) / 60000),
    );
    if (minutes > 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const handleSubscriptionToggle = async (skillSlug: string) => {
    const subscribed = subscribedSkills.has(skillSlug);
    const skillName = skillOptions.find((skill) => skill.slug === skillSlug)?.name ?? formatSkillName(skillSlug);
    try {
      await toggleSubscription.mutateAsync({ skillSlug, subscribed });
      toast.success(subscribed ? `Unsubscribed from ${skillName}` : `Subscribed to ${skillName}`);
    } catch (subscriptionError) {
      toast.error("Could not update subscription", {
        description: subscriptionError instanceof Error ? subscriptionError.message : "Please try again.",
      });
    }
  };

  const handleWatch = (video: VideoResource) => {
    const opened = window.open(video.url, "_blank", "noopener,noreferrer");
    if (!opened) {
      toast.info("Open the lesson in a new tab to watch it.");
    }
    watchVideo.mutate({
      videoId: video.id,
      videoName: video.name,
      skillSlug: video.skillSlug,
    });
  };

  const errorMessage =
    error instanceof Error
      ? error.message
      : error
        ? "We couldn't load the learning library. Please try again later."
        : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">PooTube Learning Library</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Search lessons by skill, difficulty, length or topic. Subscribe to skills you are learning so their lessons rise to the top.
          </p>
        </div>
        {!isLoading && !isError && (
          <div className="flex gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{allVideos.length} lessons</Badge>
            <Badge variant="outline">{skillOptions.length} skills</Badge>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              Learning slots: {cooldownStatus.videosWatched}/{cooldownStatus.maxVideos} used
            </span>
          </div>
          {!cooldownStatus.canWatch && cooldownStatus.cooldownEndsAt ? (
            <div className="flex items-center gap-2 text-sm text-warning">
              <Clock className="h-4 w-4" />
              Next slot in {formatTimeRemaining()}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">2 rewarded lessons every 2 hours</span>
          )}
        </CardContent>
      </Card>

      {!cooldownStatus.canWatch && (
        <Alert className="border-warning/50 bg-warning/10">
          <Leaf className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Reward cooldown active</AlertTitle>
          <AlertDescription className="text-warning/80">
            You can still browse your subscriptions and plan what to learn next. Your next rewarded lesson opens in {formatTimeRemaining()}.
          </AlertDescription>
        </Alert>
      )}

      {subscribedSkillOptions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4" />
            Your subscriptions
          </div>
          <div className="flex flex-wrap gap-2">
            {subscribedSkillOptions.map((skill) => (
              <Button
                key={skill.slug}
                type="button"
                size="sm"
                variant={selectedSkill === skill.slug ? "default" : "outline"}
                onClick={() => setSelectedSkill(selectedSkill === skill.slug ? "all" : skill.slug)}
              >
                {skill.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" />
            Find a lesson
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search guitar, mixing, hooks, channel, technique..."
              className="pl-9"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select value={selectedSkill} onValueChange={setSelectedSkill}>
              <SelectTrigger>
                <SelectValue placeholder="Skill" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All skills</SelectItem>
                {skillOptions.map((skill) => (
                  <SelectItem key={skill.slug} value={skill.slug}>{skill.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={difficulty} onValueChange={(value) => setDifficulty(value as DifficultyFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All difficulties</SelectItem>
                <SelectItem value="1">Beginner</SelectItem>
                <SelectItem value="2">Intermediate</SelectItem>
                <SelectItem value="3">Advanced</SelectItem>
              </SelectContent>
            </Select>

            <Select value={duration} onValueChange={(value) => setDuration(value as DurationFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Length" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any length</SelectItem>
                <SelectItem value="short">15 min or less</SelectItem>
                <SelectItem value="medium">16–30 min</SelectItem>
                <SelectItem value="long">Over 30 min</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger>
                <SelectValue placeholder="Topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All topics</SelectItem>
                {tagOptions.map((tag) => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">Recommended</SelectItem>
                <SelectItem value="skill">Skill A–Z</SelectItem>
                <SelectItem value="difficulty">Easiest first</SelectItem>
                <SelectItem value="shortest">Shortest first</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={followingOnly ? "default" : "outline"}
              disabled={subscribedSkills.size === 0}
              onClick={() => setFollowingOnly((current) => !current)}
            >
              <Bell className="mr-2 h-4 w-4" />
              Following only
            </Button>
            {filtersActive && (
              <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Clear filters
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {filteredVideos.length} matching {filteredVideos.length === 1 ? "lesson" : "lessons"}
            </span>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading lessons...
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load lessons</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : filteredVideos.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/40 p-8 text-center">
          <p className="font-medium">No lessons match those filters.</p>
          <p className="mt-1 text-sm text-muted-foreground">Try another skill or clear some filters.</p>
          <Button className="mt-4" variant="outline" onClick={clearFilters}>Clear filters</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredVideos.slice(0, visibleCount).map((video) => {
            const subscribed = video.skillSlug ? subscribedSkills.has(video.skillSlug) : false;
            const watchingThis = watchVideo.isPending && watchVideo.variables?.videoId === video.id;
            return (
              <Card key={video.id} className="flex h-full flex-col transition-all hover:border-primary/50 hover:shadow-md">
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{video.skillName}</Badge>
                      {video.featured && (
                        <Badge variant="default">
                          <Star className="mr-1 h-3 w-3" /> Featured
                        </Badge>
                      )}
                    </div>
                    {video.skillSlug && (
                      <Button
                        type="button"
                        size="icon"
                        variant={subscribed ? "default" : "outline"}
                        disabled={!profileId || toggleSubscription.isPending}
                        aria-label={subscribed ? `Unsubscribe from ${video.skillName}` : `Subscribe to ${video.skillName}`}
                        onClick={() => handleSubscriptionToggle(video.skillSlug!)}
                      >
                        {subscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                  <CardTitle className="text-lg leading-snug">{video.name}</CardTitle>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {video.channelName && <span>{video.channelName}</span>}
                    <span>{DIFFICULTY_LABELS[video.difficulty] ?? `Level ${video.difficulty}`}</span>
                    {video.durationMinutes != null && <span>{video.durationMinutes} min</span>}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">{video.summary}</p>
                  {video.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {video.tags.slice(0, 4).map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="cursor-pointer text-[10px]"
                          onClick={() => setSelectedTag(tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3">
                    <div>
                      <p className="text-xs font-medium text-primary">+15 education XP</p>
                      {video.skillSlug && <p className="text-[10px] text-muted-foreground">+ skill XP when eligible</p>}
                    </div>
                    <Button
                      size="sm"
                      disabled={!cooldownStatus.canWatch || watchVideo.isPending}
                      onClick={() => handleWatch(video)}
                    >
                      {watchingThis ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="mr-1 h-4 w-4" />
                      )}
                      Watch & earn
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filteredVideos.length > visibleCount && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVisibleCount((count) => count + 24)}>
            Show more lessons
          </Button>
        </div>
      )}
    </div>
  );
};
