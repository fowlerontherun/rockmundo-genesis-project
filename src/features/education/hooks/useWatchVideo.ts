import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

const STORAGE_KEY_PREFIX = "video_watch_history_";
const MAX_VIDEOS = 2;
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
const XP_PER_VIDEO = 15;

// Keep a module-level profileId for the cooldown helper
let _activeProfileId: string | null = null;

interface WatchHistory {
  timestamps: number[];
}

const getStorageKey = (profileId?: string | null): string => {
  const id = profileId || _activeProfileId || "default";
  return `${STORAGE_KEY_PREFIX}${id}`;
};

const getWatchHistory = (profileId?: string | null): WatchHistory => {
  try {
    const stored = localStorage.getItem(getStorageKey(profileId));
    if (!stored) return { timestamps: [] };
    return JSON.parse(stored);
  } catch {
    return { timestamps: [] };
  }
};

export const getCooldownStatus = (profileId?: string | null) => {
  const history = getWatchHistory(profileId);
  const now = Date.now();
  
  // Filter out timestamps older than cooldown period
  const recentTimestamps = history.timestamps.filter(
    (ts) => now - ts < COOLDOWN_MS
  );
  
  // Update storage if we filtered some out
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

export const useWatchVideo = () => {
  const { toast } = useToast();
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ videoId, videoName, skillSlug }: WatchVideoInput) => {
      const status = getCooldownStatus();
      
      if (!status.canWatch) {
        throw new Error("cooldown");
      }
      
      if (!profileId) {
        throw new Error("Not authenticated");
      }
      
      // Get profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, experience, user_id")
        .eq("id", profileId)
        .single();
      
      if (profileError || !profile) {
        throw new Error("Could not load profile");
      }
      
      // Award general XP to profile
      await supabase
        .from("profiles")
        .update({ experience: (profile.experience || 0) + XP_PER_VIDEO })
        .eq("id", profile.id);
      
      // Award skill XP if skill is linked
      if (skillSlug) {
        const validSkills = ["guitar", "bass", "drums", "vocals", "performance", "songwriting"];
        const normalizedSkill = skillSlug.toLowerCase();
        
        if (validSkills.includes(normalizedSkill)) {
          const { data: existingProgress } = await supabase
            .from("skill_progress")
            .select("id, current_xp, current_level, required_xp")
            .eq("profile_id", profile.id)
            .eq("skill_slug", normalizedSkill)
            .maybeSingle();
          
          if (existingProgress) {
            let newXp = existingProgress.current_xp + XP_PER_VIDEO;
            let newLevel = existingProgress.current_level;
            let requiredXp = existingProgress.required_xp || 100;
            
            // Handle level-ups
            while (newLevel < 100 && newXp >= requiredXp) {
              newXp -= requiredXp;
              newLevel += 1;
              requiredXp = Math.floor(requiredXp * 1.5);
            }
            
            await supabase
              .from("skill_progress")
              .update({
                current_xp: newXp,
                current_level: newLevel,
                required_xp: requiredXp,
                last_practiced_at: new Date().toISOString(),
              })
              .eq("id", existingProgress.id);
          } else {
            // Create new skill progress
            await supabase.from("skill_progress").insert({
              profile_id: profile.id,
              skill_slug: normalizedSkill,
              current_xp: XP_PER_VIDEO,
              current_level: 0,
              required_xp: 100,
              last_practiced_at: new Date().toISOString(),
            });
          }
        }
      }
      
      // Log to experience ledger
      await supabase.from("experience_ledger").insert({
        user_id: profile.user_id,
        profile_id: profile.id,
        activity_type: "youtube_video",
        xp_amount: XP_PER_VIDEO,
        skill_slug: skillSlug?.toLowerCase() || null,
        metadata: { video_id: videoId, video_name: videoName },
      });
      
      // Record watch timestamp
      const history = getWatchHistory();
      history.timestamps.push(Date.now());
      saveWatchHistory(history);
      
      return { xpEarned: XP_PER_VIDEO, skillSlug };
    },
    onSuccess: (data) => {
      const skillText = data.skillSlug ? ` and ${data.skillSlug}` : "";
      toast({
        title: "Video Watched!",
        description: `You earned ${data.xpEarned} XP${skillText}. Great learning session!`,
      });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["skill-progress"] });
    },
    onError: (error: Error) => {
      if (error.message === "cooldown") {
        const status = getCooldownStatus();
        const timeLeft = status.cooldownEndsAt
          ? Math.ceil((status.cooldownEndsAt.getTime() - Date.now()) / 60000)
          : 0;
        toast({
          title: "Take a break! 🌿",
          description: `You've watched ${MAX_VIDEOS} videos. Go touch some grass and come back in ${timeLeft} minutes!`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });
};
