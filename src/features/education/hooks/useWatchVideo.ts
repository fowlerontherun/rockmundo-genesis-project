import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

const STORAGE_KEY_PREFIX = "video_watch_history_";
const MAX_VIDEOS = 2;
const COOLDOWN_MS = 2 * 60 * 60 * 1000;
const XP_PER_VIDEO = 15;

interface WatchHistory {
  timestamps: number[];
}

const getStorageKey = (profileId?: string | null): string =>
  `${STORAGE_KEY_PREFIX}${profileId || "default"}`;

const getWatchHistory = (profileId?: string | null): WatchHistory => {
  try {
    const stored = localStorage.getItem(getStorageKey(profileId));
    if (!stored) return { timestamps: [] };
    const parsed = JSON.parse(stored) as WatchHistory;
    return Array.isArray(parsed.timestamps) ? parsed : { timestamps: [] };
  } catch {
    return { timestamps: [] };
  }
};

const saveWatchHistory = (history: WatchHistory, profileId?: string | null) => {
  localStorage.setItem(getStorageKey(profileId), JSON.stringify(history));
};

export const getCooldownStatus = (profileId?: string | null) => {
  const history = getWatchHistory(profileId);
  const now = Date.now();
  const recentTimestamps = history.timestamps.filter((ts) => now - ts < COOLDOWN_MS);

  if (recentTimestamps.length !== history.timestamps.length) {
    saveWatchHistory({ timestamps: recentTimestamps }, profileId);
  }

  const videosWatched = recentTimestamps.length;
  const canWatch = videosWatched < MAX_VIDEOS;

  let cooldownEndsAt: Date | null = null;
  if (!canWatch && recentTimestamps.length > 0) {
    const oldestTimestamp = Math.min(...recentTimestamps);
    cooldownEndsAt = new Date(oldestTimestamp + COOLDOWN_MS);
  }

  return {
    canWatch,
    videosWatched,
    maxVideos: MAX_VIDEOS,
    cooldownEndsAt,
  };
};

interface WatchVideoInput {
  videoId: string;
  videoName: string;
  skillSlug: string | null;
}

const humanizeSkill = (skillSlug: string) =>
  skillSlug
    .replace(/^instruments_/, "")
    .replace(/^genres_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const useWatchVideo = () => {
  const { toast } = useToast();
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ videoId, videoName, skillSlug }: WatchVideoInput) => {
      if (!profileId) throw new Error("Not authenticated");
      // localStorage is only a UX hint. The server owns the rolling 2-hour
      // quota, claim idempotency and all-or-nothing XP + skill progression.
      const { data, error } = await (supabase as any).rpc("reward_education_video_atomic", {
        p_profile_id: profileId,
        p_video_id: videoId,
        p_video_name: videoName,
        p_skill_slug: skillSlug?.toLowerCase().trim() || null,
      });
      if (error) {
        if (error.message.includes("education_video_cooldown")) throw new Error("cooldown");
        throw error;
      }
      const history = getWatchHistory(profileId);
      history.timestamps.push(Date.parse(data.claimedAt) || Date.now());
      try { saveWatchHistory(history, profileId); } catch { /* Server reward succeeded; browser storage is advisory only. */ }
      return {
        xpEarned: Number(data.xpEarned),
        skillSlug: data.skillSlug as string | null,
        skillXpAwarded: Boolean(data.skillXpAwarded),
        skillLocked: Boolean(data.skillLocked),
      };
    },
    onSuccess: (data) => {
      const skillName = data.skillSlug ? humanizeSkill(data.skillSlug) : null;
      const description = data.skillXpAwarded && skillName
        ? `You earned ${data.xpEarned} education XP and ${XP_PER_VIDEO} ${skillName} XP.`
        : data.skillLocked && skillName
          ? `You earned ${data.xpEarned} education XP. Unlock ${skillName} to gain skill XP from this lesson.`
          : `You earned ${data.xpEarned} education XP.`;

      toast({
        title: "Lesson completed!",
        description,
      });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["skill-progress"] });
      queryClient.invalidateQueries({ queryKey: ["skill_progress", profileId] });
      queryClient.invalidateQueries({ queryKey: ["skill-catalogue"] });
    },
    onError: (error: Error) => {
      if (error.message === "cooldown") {
        const status = getCooldownStatus(profileId);
        const timeLeft = status.cooldownEndsAt
          ? Math.ceil((status.cooldownEndsAt.getTime() - Date.now()) / 60000)
          : 0;
        toast({
          title: "Learning break",
          description: `You've completed ${MAX_VIDEOS} lessons recently. Your next slot opens in ${timeLeft} minutes.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Could not complete lesson",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });
};