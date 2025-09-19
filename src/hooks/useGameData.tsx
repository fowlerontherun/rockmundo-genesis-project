import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import type { Database } from '@/lib/supabase-types';

export type PlayerProfile = Database['public']['Tables']['profiles']['Row'];
export type PlayerSkills = { [key: string]: any } | null;
export type PlayerAttributes = { [key: string]: any } | null;
export type PlayerXpWallet = { [key: string]: any } | null;
export type ActivityItem = { [key: string]: any };

interface UseGameDataReturn {
  profile: PlayerProfile | null;
  skills: PlayerSkills | null;
  attributes: PlayerAttributes | null;
  xpWallet: PlayerXpWallet | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  // Character system compatibility
  characters: PlayerProfile[];
  selectedCharacterId: string | null;
  hasCharacters: boolean;
  setActiveCharacter: (id: string) => void;
  createCharacter: (data: any) => Promise<void>;
  refreshCharacters: () => Promise<void>;
  resetCharacter: () => Promise<void>;
}

export const useGameData = (): UseGameDataReturn => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [attributes, setAttributes] = useState<PlayerAttributes | null>(null);
  const [xpWallet, setXpWallet] = useState<PlayerXpWallet | null>(null);
  const [characters, setCharacters] = useState<PlayerProfile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) {
      setProfile(null);
      setSkills(null);
      setAttributes(null);
      setXpWallet(null);
      setCharacters([]);
      setSelectedCharacterId(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch profile(s) - treating profiles as characters
      const { data: profilesData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id);

      if (profileError) throw profileError;
      
      const profiles = (profilesData || []) as PlayerProfile[];
      setCharacters(profiles);
      
      // Set the first profile as active if no selection
      const activeProfile = profiles.length > 0 ? profiles[0] : null;
      setProfile(activeProfile);
      if (activeProfile) {
        setSelectedCharacterId(activeProfile.id);
      }

      if (activeProfile) {
        // Fetch skills - handle missing table gracefully
        try {
          const { data: skillsData } = await supabase
            .from('player_skills')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          setSkills(skillsData);
        } catch {
          setSkills(null);
        }

        // Fetch attributes - handle missing table gracefully
        try {
          const { data: attributesData } = await supabase
            .from('player_attributes')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          setAttributes(attributesData);
        } catch {
          setAttributes(null);
        }

        // Fetch XP wallet - handle missing table gracefully
        try {
          const { data: xpWalletData } = await supabase
            .from('player_xp_wallet')
            .select('*')
            .eq('profile_id', activeProfile.id)
            .maybeSingle();
          setXpWallet(xpWalletData);
        } catch {
          setXpWallet(null);
        }
      }
    } catch (err) {
      console.error('Error fetching game data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch game data');
    } finally {
      setLoading(false);
    }
  };

  const setActiveCharacter = (id: string) => {
    const character = characters.find(c => c.id === id);
    if (character) {
      setProfile(character);
      setSelectedCharacterId(id);
    }
  };

  const createCharacter = async (data: any) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          username: data.username || 'New Character',
          display_name: data.display_name || 'New Character'
        });

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error creating character:', err);
      throw err;
    }
  };

  const resetCharacter = async () => {
    if (!user) {
      throw new Error('Authentication required to reset character');
    }

    try {
      const { data, error } = await supabase.rpc('reset_player_character');

      if (error) {
        throw error;
      }

      const [result] = (data ?? []) as Array<{
        profile: PlayerProfile;
        skills: PlayerSkills;
      }>;

      if (result?.profile) {
        setProfile(result.profile);
        setSelectedCharacterId(result.profile.id);
        setCharacters([result.profile]);
      } else {
        setProfile(null);
        setSelectedCharacterId(null);
        setCharacters([]);
      }

      if (result?.skills) {
        setSkills(result.skills);
      } else {
        setSkills(null);
      }

      setAttributes(null);
      setXpWallet(null);
    } catch (err) {
      console.error('Error resetting character:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  return {
    profile,
    skills,
    attributes,
    xpWallet,
    characters,
    selectedCharacterId,
    hasCharacters: characters.length > 0,
    loading,
    error,
    refetch: fetchData,
    setActiveCharacter,
    createCharacter,
    refreshCharacters: fetchData,
    resetCharacter
  };
};

// Add missing exports for compatibility
export type SkillDefinition = { [key: string]: any };
export type SkillProgressRow = { [key: string]: any };

// Add a dummy GameDataProvider for compatibility
export const GameDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};