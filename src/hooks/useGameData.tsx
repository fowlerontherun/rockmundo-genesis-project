import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import type { Tables } from "@/integrations/supabase/types";
import type {
  PostgrestError,
  PostgrestResponse,
  PostgrestSingleResponse
} from "@supabase/supabase-js";

export type PlayerProfile = Tables<'profiles'>;

export type PlayerSkills = Tables<'player_skills'>;

export type ActivityItem = Tables<'activity_feed'>;

type ResetCharacterResult = {
  profile: PlayerProfile;
  skills: PlayerSkills;
};

const isPostgrestError = (error: unknown): error is PostgrestError =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  "code" in error;

export const useGameData = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGameData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch profile
      const {
        data: profileData,
        error: profileError
      }: PostgrestSingleResponse<PlayerProfile> = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      // Fetch skills
      const {
        data: skillsData,
        error: skillsError
      }: PostgrestSingleResponse<PlayerSkills> = await supabase
        .from('player_skills')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (skillsError) throw skillsError;

      // Fetch recent activities
      const {
        data: activitiesData,
        error: activitiesError
      }: PostgrestResponse<ActivityItem> = await supabase
        .from('activity_feed')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (activitiesError) throw activitiesError;

      setProfile(profileData);
      setSkills(skillsData);
      setActivities(activitiesData ?? []);
    } catch (err: unknown) {
      console.error('Error fetching game data:', err);
      if (isPostgrestError(err)) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred while fetching game data.');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchGameData();
  }, [fetchGameData]);

  const updateProfile = useCallback(
    async (updates: Partial<PlayerProfile>) => {
      if (!user || !profile) return;

      try {
        const { data, error }: PostgrestSingleResponse<PlayerProfile> = await supabase
          .from('profiles')
          .update(updates)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        if (!data) {
          throw new Error('No profile data returned from Supabase.');
        }
        setProfile(data);
        return data;
      } catch (err: unknown) {
        console.error('Error updating profile:', err);
        if (isPostgrestError(err)) {
          throw err;
        }
        if (err instanceof Error) {
          throw err;
        }
        throw new Error('An unknown error occurred while updating the profile.');
      }
    },
    [profile, user]
  );

  const updateSkills = useCallback(
    async (updates: Partial<PlayerSkills>) => {
      if (!user || !skills) return;

      try {
        const { data, error }: PostgrestSingleResponse<PlayerSkills> = await supabase
          .from('player_skills')
          .update(updates)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        if (!data) {
          throw new Error('No skill data returned from Supabase.');
        }
        setSkills(data);
        return data;
      } catch (err: unknown) {
        console.error('Error updating skills:', err);
        if (isPostgrestError(err)) {
          throw err;
        }
        if (err instanceof Error) {
          throw err;
        }
        throw new Error('An unknown error occurred while updating skills.');
      }
    },
    [skills, user]
  );

  const addActivity = useCallback(
    async (activityType: string, message: string, earnings: number = 0) => {
      if (!user) return;

      try {
        const { data, error }: PostgrestSingleResponse<ActivityItem> = await supabase
          .from('activity_feed')
          .insert({
            user_id: user.id,
            activity_type: activityType,
            message,
            earnings
          })
          .select()
          .single();

        if (error) throw error;
        if (!data) {
          throw new Error('No activity data returned from Supabase.');
        }

        // Add to local state
        setActivities(prev => [data, ...prev.slice(0, 9)]);
        return data;
      } catch (err: unknown) {
        console.error('Error adding activity:', err);
        if (isPostgrestError(err)) {
          throw err;
        }
        if (err instanceof Error) {
          throw err;
        }
        throw new Error('An unknown error occurred while adding activity.');
      }
    },
    [user]
  );

  const updateLocation = useCallback(
    async (location: string, cityId?: string | null) => {
      const updates: Partial<PlayerProfile> = {
        current_location: location,
        current_city_id: cityId ?? null
      };
      return updateProfile(updates);
    },
    [updateProfile]
  );

  const updateHealth = useCallback(
    async (health: number) => {
      return updateProfile({ health });
    },
    [updateProfile]
  );

  const updateCurrentCity = useCallback(
    async (cityId: string | null) => {
      return updateProfile({ current_city_id: cityId });
    },
    [updateProfile]
  );

  const resetCharacter = useCallback(async () => {
    if (!user) {
      throw new Error('You must be signed in to reset your character.');
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('reset_player_character');

      if (error) throw error;

      const resetData = (data as ResetCharacterResult[] | null)?.[0];

      if (!resetData) {
        throw new Error('No data returned from Supabase when resetting the character.');
      }

      setProfile(resetData.profile);
      setSkills(resetData.skills);
      setActivities([]);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('rockmundo:needsOnboarding', 'true');
      }

      await fetchGameData();

      return resetData;
    } catch (err: unknown) {
      console.error('Error resetting character:', err);
      if (isPostgrestError(err)) {
        throw err;
      }
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('An unknown error occurred while resetting the character.');
    } finally {
      setLoading(false);
    }
  }, [user, fetchGameData]);

  return {
    profile,
    skills,
    activities,
    loading,
    error,
    updateProfile,
    updateSkills,
    updateLocation,
    updateHealth,
    updateCurrentCity,
    addActivity,
    resetCharacter,
    refetch: fetchGameData
  };
};