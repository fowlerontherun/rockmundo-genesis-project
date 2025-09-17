import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import type { Tables } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

export type PlayerProfile = Tables<'profiles'>;

export type PlayerSkills = Tables<'player_skills'>;

export type ActivityItem = Tables<'activity_feed'>;

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
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      // Fetch skills
      const { data: skillsData, error: skillsError } = await supabase
        .from('player_skills')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (skillsError) throw skillsError;

      // Fetch recent activities
      const { data: activitiesData, error: activitiesError } = await supabase
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
      if (err instanceof Error) {
        setError(err.message);
      } else if (isPostgrestError(err)) {
        setError(err.message);
      } else {
        setError('An unknown error occurred while fetching game data.');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchGameData();
    }
  }, [user, fetchGameData]);

  const updateProfile = async (updates: Partial<PlayerProfile>) => {
    if (!user || !profile) return;

    try {
      const { data, error } = await supabase
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
      if (err instanceof Error) {
        throw err;
      }
      if (isPostgrestError(err)) {
        throw err;
      }
      throw new Error('An unknown error occurred while updating the profile.');
    }
  };

  const updateSkills = async (updates: Partial<PlayerSkills>) => {
    if (!user || !skills) return;

    try {
      const { data, error } = await supabase
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
      if (err instanceof Error) {
        throw err;
      }
      if (isPostgrestError(err)) {
        throw err;
      }
      throw new Error('An unknown error occurred while updating skills.');
    }
  };

  const addActivity = async (activityType: string, message: string, earnings: number = 0) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
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
      if (err instanceof Error) {
        throw err;
      }
      if (isPostgrestError(err)) {
        throw err;
      }
      throw new Error('An unknown error occurred while adding activity.');
    }
  };

  return {
    profile,
    skills,
    activities,
    loading,
    error,
    updateProfile,
    updateSkills,
    addActivity,
    refetch: fetchGameData
  };
};