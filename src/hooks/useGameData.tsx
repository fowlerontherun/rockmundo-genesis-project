import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import type { Database } from '@/lib/supabase-types';

export type PlayerProfile = Database['public']['Tables']['profiles']['Row'];
export type PlayerSkills = { [key: string]: any } | null;
export type PlayerAttributes = { [key: string]: any } | null;
export type PlayerXpWallet = { [key: string]: any } | null;
export type ActivityItem = { [key: string]: any };
export type PlayerXpLedgerEntry = Database['public']['Tables']['xp_ledger']['Row'];

interface UseGameDataReturn {
  profile: PlayerProfile | null;
  skills: PlayerSkills | null;
  attributes: PlayerAttributes | null;
  xpWallet: PlayerXpWallet | null;
  xpLedger: PlayerXpLedgerEntry[];
  freshWeeklyBonusAvailable: boolean;
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
  updateProfile: (updates: Partial<PlayerProfile>) => Promise<PlayerProfile | null>;
  addActivity: (
    activityType: string,
    message: string,
    earnings?: number,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
}

export const useGameData = (): UseGameDataReturn => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [attributes, setAttributes] = useState<PlayerAttributes | null>(null);
  const [xpWallet, setXpWallet] = useState<PlayerXpWallet | null>(null);
  const [xpLedger, setXpLedger] = useState<PlayerXpLedgerEntry[]>([]);
  const [characters, setCharacters] = useState<PlayerProfile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshWeeklyBonusAvailable, setFreshWeeklyBonusAvailable] = useState(false);

  const parseMetadataRecord = (metadata: unknown): Record<string, unknown> | null => {
    if (!metadata) return null;

    if (typeof metadata === 'string') {
      try {
        const parsed = JSON.parse(metadata);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    }

    if (typeof metadata === 'object' && !Array.isArray(metadata)) {
      return metadata as Record<string, unknown>;
    }

    return null;
  };

  const computeFreshWeeklyBonus = useCallback(
    (currentProfile: PlayerProfile | null, ledgerEntries: PlayerXpLedgerEntry[]): boolean => {
      if (!currentProfile) return false;

      const candidates: Date[] = [];

      if (currentProfile.last_weekly_bonus_at) {
        const parsed = new Date(currentProfile.last_weekly_bonus_at);
        if (!Number.isNaN(parsed.getTime())) {
          candidates.push(parsed);
        }
      }

      const metadataRecord = parseMetadataRecord(currentProfile.weekly_bonus_metadata);
      const metadataTimestamp = metadataRecord?.updated_at;
      if (typeof metadataTimestamp === 'string') {
        const parsed = new Date(metadataTimestamp);
        if (!Number.isNaN(parsed.getTime())) {
          candidates.push(parsed);
        }
      }

      const ledgerBonus = ledgerEntries.find(entry => entry.event_type === 'weekly_bonus');
      if (ledgerBonus?.created_at) {
        const parsed = new Date(ledgerBonus.created_at);
        if (!Number.isNaN(parsed.getTime())) {
          candidates.push(parsed);
        }
      }

      if (candidates.length === 0) {
        return false;
      }

      const mostRecent = candidates.reduce((latest, date) => (date > latest ? date : latest), candidates[0]);
      const diffMs = Date.now() - mostRecent.getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      return diffMs >= 0 && diffMs <= sevenDaysMs;
    },
    []
  );

  const resetCharacterData = useCallback(() => {
    setSkills(null);
    setAttributes(null);
    setXpWallet(null);
    setXpLedger([]);
    setFreshWeeklyBonusAvailable(false);
  }, []);

  const loadProfileDetails = useCallback(
    async (activeProfile: PlayerProfile | null) => {
      if (!user || !activeProfile) {
        resetCharacterData();
        return;
      }

      try {
        const { data: skillsData, error: skillsError } = await supabase
          .from('player_skills')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (skillsError && skillsError.code !== 'PGRST116') throw skillsError;
        setSkills(skillsData ?? null);
      } catch (err) {
        console.error('Error fetching player skills:', err);
        setSkills(null);
      }

      try {
        const { data: attributesData, error: attributesError } = await supabase
          .from('player_attributes')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (attributesError && attributesError.code !== 'PGRST116') throw attributesError;
        setAttributes(attributesData ?? null);
      } catch (err) {
        console.error('Error fetching player attributes:', err);
        setAttributes(null);
      }

      try {
        const { data: xpWalletData, error: xpWalletError } = await supabase
          .from('player_xp_wallet')
          .select('*')
          .eq('profile_id', activeProfile.id)
          .maybeSingle();

        if (xpWalletError && xpWalletError.code !== 'PGRST116') throw xpWalletError;
        setXpWallet(xpWalletData ?? null);
      } catch (err) {
        console.error('Error fetching XP wallet:', err);
        setXpWallet(null);
      }

      let ledgerEntries: PlayerXpLedgerEntry[] = [];
      try {
        const { data: xpLedgerData, error: xpLedgerError } = await supabase
          .from('xp_ledger')
          .select('*')
          .eq('profile_id', activeProfile.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (xpLedgerError && xpLedgerError.code !== 'PGRST116') throw xpLedgerError;
        ledgerEntries = (xpLedgerData ?? []) as PlayerXpLedgerEntry[];
        setXpLedger(ledgerEntries);
      } catch (err) {
        console.error('Error fetching XP ledger:', err);
        ledgerEntries = [];
        setXpLedger([]);
      }

      setFreshWeeklyBonusAvailable(computeFreshWeeklyBonus(activeProfile, ledgerEntries));
    },
    [computeFreshWeeklyBonus, resetCharacterData, user]
  );

  const fetchData = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setSkills(null);
      setAttributes(null);
      setXpWallet(null);
      setXpLedger([]);
      setCharacters([]);
      setSelectedCharacterId(null);
      setFreshWeeklyBonusAvailable(false);
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

      const preferredProfile = selectedCharacterId
        ? profiles.find(character => character.id === selectedCharacterId) ?? null
        : null;

      const activeProfile = preferredProfile ?? (profiles.length > 0 ? profiles[0] : null);
      setProfile(activeProfile);
      setSelectedCharacterId(activeProfile ? activeProfile.id : null);

      await loadProfileDetails(activeProfile);
    } catch (err) {
      console.error('Error fetching game data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch game data');
    } finally {
      setLoading(false);
    }
  }, [loadProfileDetails, selectedCharacterId, user]);

  const setActiveCharacter = useCallback(
    (id: string) => {
      const character = characters.find(c => c.id === id);
      if (character) {
        setProfile(character);
        setSelectedCharacterId(character.id);
        void loadProfileDetails(character);
      }
    },
    [characters, loadProfileDetails]
  );

  const createCharacter = useCallback(async (data: any) => {
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
  }, [fetchData, user]);

  const updateProfile = useCallback(
    async (updates: Partial<PlayerProfile>) => {
      if (!user || !profile) {
        throw new Error('No active profile to update');
      }

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id)
        .select('*')
        .maybeSingle();

      if (updateError) {
        console.error('Error updating profile:', updateError);
        throw updateError;
      }

      const updatedProfile = (data ?? null) as PlayerProfile | null;
      if (updatedProfile) {
        setProfile(updatedProfile);
        setCharacters(prev => prev.map(character => (character.id === updatedProfile.id ? updatedProfile : character)));
        await loadProfileDetails(updatedProfile);
      } else {
        await fetchData();
      }

      return updatedProfile;
    },
    [fetchData, loadProfileDetails, profile, user]
  );

  const addActivity = useCallback(
    async (
      activityType: string,
      message: string,
      earnings?: number,
      metadata?: Record<string, unknown>
    ) => {
      if (!user) {
        throw new Error('User must be signed in to add activity');
      }

      const payload: Record<string, unknown> = {
        user_id: user.id,
        activity_type: activityType,
        message,
      };

      if (typeof earnings === 'number') {
        payload.earnings = earnings;
      }

      if (metadata) {
        payload.metadata = metadata;
      }

      if (profile?.id) {
        payload.profile_id = profile.id;
      }

      const { error: activityError } = await supabase.from('activity_feed').insert(payload);

      if (activityError) {
        console.error('Error logging activity:', activityError);
        throw activityError;
      }
    },
    [profile?.id, user]
  );

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
    void fetchData();
  }, [fetchData]);

  return {
    profile,
    skills,
    attributes,
    xpWallet,
    xpLedger,
    characters,
    selectedCharacterId,
    hasCharacters: characters.length > 0,
    loading,
    error,
    refetch: fetchData,
    setActiveCharacter,
    createCharacter,
    refreshCharacters: fetchData,
    updateProfile,
    addActivity,
    freshWeeklyBonusAvailable
  };
};

// Add missing exports for compatibility
export type SkillDefinition = { [key: string]: any };
export type SkillProgressRow = { [key: string]: any };

// Add a dummy GameDataProvider for compatibility
export const GameDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};