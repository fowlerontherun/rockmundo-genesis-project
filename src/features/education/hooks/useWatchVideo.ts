import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { awardActionXp } from "@/utils/progression";
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

const BASIC_VIDEO_UNLOCKS = new Set([
  "guitar",
  "bass",
  "drums",
  "vocals",
  "performance",
  "songwriting",
]);

const canVideoStartSkill = (skillSlug: string) =>
  BASIC_VIDEO_UNLOCKS.has(skillSlug) ||
  skillSlug.startsWith("basic_") ||
  skillSlug.startsWith("instruments_basic_") ||
  skillSlug.startsWith("genres_basic_");

const humanizeSkill = (skillSlug: string) =>
  skillSlug
    .replace(/^instruments_/, "")
    .replace(/^genres_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getRequiredSkillXp = async (level: number) => {
  const { data, error } = await (supabase as any).rpc("progression_skill_required_xp", {
    p_level: level,
  });
  if (error) throw error;
  return Number(data) || 100;
};

export const useWatchVideo = () => {
  const { toast } = useToast();
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ videoId, videoName, skillSlug }: WatchVideoInput) => {
      const status = getCooldownStatus(profileId);

      if (!status.canWatch) throw new Error("cooldown");
      if (!profileId) throw new Error("Not authenticated");

      const transactionRef = `education-video:${profileId}:${videoId}:${Math.floor(Date.now() / COOLDOWN_MS)}`;

      await awardActionXp({
        amount: XP_PER_VIDEO,
        category: "education",
        actionKey: "youtube_video",
        uniqueEventId: transactionRef,
        metadata: {
          video_id: videoId,
          video_name: videoName,
          skill_slug: skillSlug?.toLowerCase() || null,
        },
      });

      let skillXpAwarded = false;
      let skillLocked = false;
      const normalizedSkill = skillSlug?.toLowerCase().trim() || null;

      if (normalizedSkill) {
        try {
          const { data: skillDefinition, error: skillDefinitionError } = await supabase
            .from("skill_definitions")
            .select("slug")
            .eq("slug", normalizedSkill)
            .maybeSingle();

          if (skillDefinitionError) throw skillDefinitionError;

          if (skillDefinition) {
            const { data: existingProgress, error: skillLoadError } = await supabase
              .from("skill_progress")
              .select("id, current_xp, current_level, required_xp")
              .eq("profile_id", profileId)
              .eq("skill_slug", normalizedSkill)
              .maybeSingle();

            if (skillLoadError) throw skillLoadError;

            if (existingProgress) {
              let newXp = existingProgress.current_xp + XP_PER_VIDEO;
              let newLevel = existingProgress.current_level;
              let requiredXp = existingProgress.required_xp || (await getRequiredSkillXp(newLevel));

              while (newLevel < 100 && newXp >= requiredXp) {
                newXp -= requiredXp;
                newLevel += 1;
                requiredXp = await getRequiredSkillXp(newLevel);
              }

              const { error: skillUpdateError } = await supabase
                .from("skill_progress")
                .update({
                  current_xp: newXp,
                  current_level: newLevel,
                  required_xp: requiredXp,
                  last_practiced_at: new Date().toISOString(),
                })
                .eq("id", existingProgress.id);

              if (skillUpdateError) throw skillUpdateError;
              skillXpAwarded = true;
            } else if (canVideoStartSkill(normalizedSkill)) {
              const requiredXp = await getRequiredSkillXp(0);
              const { error: skillInsertError } = await supabase.from("skill_progress").insert({
                profile_id: profileId,
                skill_slug: normalizedSkill,
                current_xp: XP_PER_VIDEO,
                current_level: 0,
                required_xp: requiredXp,
                last_practiced_at: new Date().toISOString(),
              });

              if (skillInsertError) throw skillInsertError;
              skillXpAwarded = true;
            } else {
              skillLocked = true;
            }
          }
        } catch (skillError) {
          console.error("Video watched but skill XP could not be applied", skillError);
        }
      }

      const history = getWatchHistory(profileId);
      history.timestamps.push(Date.now());
      saveWatchHistory(history, profileId);

      return {
        xpEarned: XP_PER_VIDEO,
        skillSlug: normalizedSkill,
        skillXpAwarded,
        skillLocked,
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
