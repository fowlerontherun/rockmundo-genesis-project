import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PlayerProfile {
  id: string;
  username: string;
  display_name: string;
  level: number;
  experience: number;
  cash: number;
  fame: number;
  avatar_url?: string;
  bio?: string;
}

export interface PlayerSkills {
  vocals: number;
  guitar: number;
  bass: number;
  drums: number;
  songwriting: number;
  performance: number;
}

export interface ActivityItem {
  id: string;
  activity_type: string;
  message: string;
  earnings: number;
  created_at: string;
}

export const useGameData = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchGameData();
    }
  }, [user]);

  const fetchGameData = async () => {
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
      setActivities(activitiesData || []);
    } catch (error: unknown) {
      const fallbackMessage = 'Failed to fetch game data';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error fetching game data:', errorMessage, error);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
      setProfile(data);
      return data;
    } catch (error: unknown) {
      const fallbackMessage = 'Failed to update profile';
      const errorToThrow = error instanceof Error ? error : new Error(fallbackMessage);
      console.error('Error updating profile:', errorToThrow.message, error);
      throw errorToThrow;
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
      setSkills(data);
      return data;
    } catch (error: unknown) {
      const fallbackMessage = 'Failed to update skills';
      const errorToThrow = error instanceof Error ? error : new Error(fallbackMessage);
      console.error('Error updating skills:', errorToThrow.message, error);
      throw errorToThrow;
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
      
      // Add to local state
      setActivities(prev => [data, ...prev.slice(0, 9)]);
      return data;
    } catch (error: unknown) {
      const fallbackMessage = 'Failed to add activity';
      const errorToThrow = error instanceof Error ? error : new Error(fallbackMessage);
      console.error('Error adding activity:', errorToThrow.message, error);
      throw errorToThrow;
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