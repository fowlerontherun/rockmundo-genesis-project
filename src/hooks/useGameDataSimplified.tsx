import { createContext, useCallback, useContext, useEffect, useState, useRef } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";
import { useAuth } from "@/hooks/use-auth-context";

export type PlayerProfile = Database["public"]["Tables"]["profiles"]["Row"];
export type PlayerXpWallet = Database["public"]["Tables"]["player_xp_wallet"]["Row"] | null;
export type PlayerAttributes = Database["public"]["Tables"]["player_attributes"]["Row"] | null;

interface GameDataContextType {
  profile: PlayerProfile | null;
  attributes: PlayerAttributes;
  wallet: PlayerXpWallet;
  loading: boolean;
  error: string | null;
  profileUpsert: (input: ProfileUpsertInput) => Promise<void>;
  refetchProfile: () => Promise<void>;
  refetch: () => Promise<void>; // Alias for compatibility
  currentCity: any; // Placeholder for compatibility
}

export interface ProfileUpsertInput {
  name: string;
  stageName: string;
  bio: string;
}

const GameDataContext = createContext<GameDataContextType | null>(null);

export const useGameData = () => {
  const context = useContext(GameDataContext);
  if (!context) {
    throw new Error("useGameData must be used within a GameDataProvider");
  }
  return context;
};

interface GameDataProviderProps {
  children: ReactNode;
}

export const GameDataProvider = ({ children }: GameDataProviderProps) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [attributes, setAttributes] = useState<PlayerAttributes>(null);
  const [wallet, setWallet] = useState<PlayerXpWallet>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadProfileData = useCallback(async () => {
    if (!user?.id || loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile load error:", profileError);
        setError(profileError.message);
        return;
      }

      setProfile(profileData);

      if (profileData) {
        // Load attributes
        const { data: attributesData, error: attributesError } = await supabase
          .from("player_attributes")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (attributesError && attributesError.code !== "PGRST116") {
          console.warn("Attributes load error:", attributesError);
        } else {
          setAttributes(attributesData);
        }

        // Load wallet
        const { data: walletData, error: walletError } = await supabase
          .from("player_xp_wallet")
          .select("*")
          .eq("profile_id", profileData.id)
          .maybeSingle();

        if (walletError && walletError.code !== "PGRST116") {
          console.warn("Wallet load error:", walletError);
        } else {
          setWallet(walletData);
        }
      }
    } catch (err) {
      console.error("Failed to load game data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [user?.id]);

  const profileUpsert = useCallback(async (input: ProfileUpsertInput) => {
    if (!user?.id) throw new Error("User not authenticated");

    try {
      setLoading(true);
      
      const profilePayload = {
        user_id: user.id,
        username: input.name,
        display_name: input.stageName,
        bio: input.bio,
      };

      if (profile) {
        // Update existing profile
        const { data, error } = await supabase
          .from("profiles")
          .update(profilePayload)
          .eq("id", profile.id)
          .select("*")
          .single();

        if (error) throw error;
        setProfile(data);
      } else {
        // Create new profile
        const { data, error } = await supabase
          .from("profiles")
          .insert(profilePayload)
          .select("*")
          .single();

        if (error) throw error;
        setProfile(data);

        // Create initial attributes if profile was created
        if (data) {
          const attributePayload = {
            user_id: user.id,
            profile_id: data.id,
            charisma: 10,
            looks: 10,
            mental_focus: 10,
            musicality: 10,
            physical_endurance: 10,
            stage_presence: 10,
            crowd_engagement: 10,
            social_reach: 10,
            business_acumen: 10,
            marketing_savvy: 10,
            creative_insight: 10,
            technical_mastery: 10,
            musical_ability: 10,
            vocal_talent: 10,
            rhythm_sense: 10,
            attribute_points: 0,
            attribute_points_spent: 0,
          };

          const { error: attrError } = await supabase
            .from("player_attributes")
            .insert(attributePayload);

          if (attrError) {
            console.warn("Failed to create initial attributes:", attrError);
          }

          // Create initial wallet
          const walletPayload = {
            profile_id: data.id,
            xp_balance: 0,
            xp_spent: 0,
            lifetime_xp: 0,
            attribute_points_earned: 0,
            skill_points_earned: 0,
          };

          const { error: walletError } = await supabase
            .from("player_xp_wallet")
            .insert(walletPayload);

          if (walletError) {
            console.warn("Failed to create initial wallet:", walletError);
          }
        }
      }

      // Refresh all data after upsert
      await loadProfileData();
    } catch (err) {
      console.error("Profile upsert failed:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id, profile, loadProfileData]);

  const refetchProfile = useCallback(async () => {
    await loadProfileData();
  }, [loadProfileData]);

  useEffect(() => {
    if (user?.id) {
      loadProfileData();
    } else {
      setProfile(null);
      setAttributes(null);
      setWallet(null);
      setLoading(false);
      setError(null);
    }
  }, [user?.id, loadProfileData]);

  const contextValue: GameDataContextType = {
    profile,
    attributes,
    wallet,
    loading,
    error,
    profileUpsert,
    refetchProfile,
    refetch: refetchProfile, // Alias for compatibility
    currentCity: null, // Placeholder for compatibility
  };

  return (
    <GameDataContext.Provider value={contextValue}>
      {children}
    </GameDataContext.Provider>
  );
};