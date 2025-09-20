import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth-context";
import { awardActionXp as awardActionXpUtility, type AwardActionXpInput } from "@/utils/progression";

export type PlayerProfile = Database["public"]["Tables"]["profiles"]["Row"];
export type PlayerSkills = Database["public"]["Tables"]["player_skills"]["Row"] | null;
type AttributeCategory =
  | "creativity"
  | "business"
  | "marketing"
  | "technical"
  | "charisma"
  | "looks"
  | "mental_focus"
  | "musicality"
  | "physical_endurance"
  | "stage_presence"
  | "crowd_engagement"
  | "social_reach"
  | "business_acumen"
  | "marketing_savvy";

export type PlayerAttributes = Record<AttributeCategory, number>;
export type PlayerXpWallet = Database["public"]["Tables"]["player_xp_wallet"]["Row"] | null;
export type SkillProgressRow = Database["public"]["Tables"]["skill_progress"]["Row"];
export type ExperienceLedgerRow = Database["public"]["Tables"]["experience_ledger"]["Row"];
export type UnlockedSkillsMap = Record<string, boolean>;
export type ActivityFeedRow = Database["public"]["Tables"]["activity_feed"]["Row"];

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type SkillsUpdate = Database["public"]["Tables"]["player_skills"]["Update"];
type AttributesUpdate = Partial<PlayerAttributes>;
type ActivityInsert = Database["public"]["Tables"]["activity_feed"]["Insert"];
type CityRow = Database["public"]["Tables"]["cities"]["Row"];
type PlayerAttributesRow = Database["public"]["Tables"]["player_attributes"]["Row"];
type RawAttributes = PlayerAttributesRow | null;

const ATTRIBUTE_COLUMN_MAP: Record<AttributeCategory, keyof PlayerAttributesRow> = {
  creativity: "creative_insight",
  business: "business_acumen",
  marketing: "marketing_savvy",
  technical: "technical_mastery",
  charisma: "charisma",
  looks: "looks",
  mental_focus: "mental_focus",
  musicality: "musicality",
  physical_endurance: "physical_endurance",
  stage_presence: "stage_presence",
  crowd_engagement: "crowd_engagement",
  social_reach: "social_reach",
  business_acumen: "business_acumen",
  marketing_savvy: "marketing_savvy",
};

const XP_LEDGER_FETCH_LIMIT = 20;
const WEEKLY_WINDOW_ANCHOR_UTC_HOUR = 5;
const WEEKLY_WINDOW_ANCHOR_UTC_MINUTE = 15;

const getCurrentWeeklyWindowStart = (referenceDate: Date): Date => {
  const result = new Date(referenceDate);
  const utcDay = result.getUTCDay();
  const daysSinceMonday = (utcDay + 6) % 7;
  result.setUTCDate(result.getUTCDate() - daysSinceMonday);
  result.setUTCHours(WEEKLY_WINDOW_ANCHOR_UTC_HOUR, WEEKLY_WINDOW_ANCHOR_UTC_MINUTE, 0, 0);

  if (result > referenceDate) {
    result.setUTCDate(result.getUTCDate() - 7);
  }

  return result;
};

const isWeeklyBonusFresh = (ledger: ExperienceLedgerRow[]): boolean => {
  if (!Array.isArray(ledger) || ledger.length === 0) {
    return false;
  }

  const latestWeeklyBonus = ledger.find((entry) => entry.event_type === "weekly_bonus");
  if (!latestWeeklyBonus || !latestWeeklyBonus.created_at) {
    return false;
  }

  const recordedAt = new Date(latestWeeklyBonus.created_at);
  if (Number.isNaN(recordedAt.getTime())) {
    return false;
  }

  const windowStart = getCurrentWeeklyWindowStart(new Date());
  return recordedAt >= windowStart;
};

interface UseGameDataReturn {
  profile: PlayerProfile | null;
  skills: PlayerSkills;
  attributes: PlayerAttributes | null;
  xpWallet: PlayerXpWallet;
  xpLedger: ExperienceLedgerRow[];
  skillProgress: SkillProgressRow[];
  unlockedSkills: UnlockedSkillsMap;
  activities: ActivityFeedRow[];
  freshWeeklyBonusAvailable: boolean;
  currentCity: CityRow | null;
  loading: boolean;
  error: string | null;
  characters: PlayerProfile[];
  selectedCharacterId: string | null;
  hasCharacters: boolean;
  refetch: () => Promise<void>;
  refreshCharacters: () => Promise<void>;
  setActiveCharacter: (id: string) => Promise<void>;
  createCharacter: (data: Partial<PlayerProfile>) => Promise<void>;
  resetCharacter: () => Promise<void>;
  updateProfile: (updates: ProfileUpdate) => Promise<PlayerProfile>;
  updateSkills: (updates: SkillsUpdate) => Promise<PlayerSkills>;
  updateAttributes: (updates: AttributesUpdate) => Promise<PlayerAttributes | null>;
  addActivity: (type: string, message: string, earnings?: number, metadata?: ActivityInsert["metadata"]) => Promise<void>;
  awardActionXp: (input: AwardActionXpInput) => Promise<void>;
}

const mapAttributes = (row: RawAttributes): PlayerAttributes | null => {
  if (!row) {
    return null;
  }

  return (Object.entries(ATTRIBUTE_COLUMN_MAP) as Array<[AttributeCategory, keyof PlayerAttributesRow]>).reduce(
    (accumulator, [category, column]) => {
      const rawValue = row[column];
      accumulator[category] = typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : 0;
      return accumulator;
    },
    {} as Record<AttributeCategory, number>,
  );
};

export const useGameData = (): UseGameDataReturn => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [characters, setCharacters] = useState<PlayerProfile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [skills, setSkills] = useState<PlayerSkills>(null);
  const [attributes, setAttributes] = useState<PlayerAttributes | null>(null);
  const [xpWallet, setXpWallet] = useState<PlayerXpWallet>(null);
  const [xpLedger, setXpLedger] = useState<ExperienceLedgerRow[]>([]);
  const [skillProgress, setSkillProgress] = useState<SkillProgressRow[]>([]);
  const [unlockedSkills, setUnlockedSkills] = useState<UnlockedSkillsMap>({});
  const [activities, setActivities] = useState<ActivityFeedRow[]>([]);
  const [currentCity, setCurrentCity] = useState<CityRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assigningDefaultCityRef = useRef(false);
  const loadCharacterDetails = useCallback(
    async (activeProfile: PlayerProfile | null) => {
      if (!user || !activeProfile) {
        setSkills(null);
        setAttributes(null);
        setXpWallet(null);
        setXpLedger([]);
        setSkillProgress([]);
        setUnlockedSkills({});
        setActivities([]);
        setCurrentCity(null);
        return;
      }

      let effectiveProfile = activeProfile;

      if (!effectiveProfile.current_city_id && !assigningDefaultCityRef.current) {
        assigningDefaultCityRef.current = true;
        try {
          const { data: londonCity, error: londonCityError } = await supabase
            .from("cities")
            .select("id")
            .eq("name", "London")
            .maybeSingle();

          if (londonCityError) {
            console.error("Failed to load default London city", londonCityError);
          } else if (londonCity?.id) {
            const { data: updatedProfileData, error: updateError } = await supabase
              .from("profiles")
              .update({ current_city_id: londonCity.id })
              .eq("id", effectiveProfile.id)
              .select("*")
              .single();

            if (updateError) {
              console.error("Failed to assign London as default city", updateError);
            } else if (updatedProfileData) {
              const updatedProfile = updatedProfileData as PlayerProfile;
              effectiveProfile = updatedProfile;
              setProfile((previous) => {
                if (previous && previous.id !== updatedProfile.id) {
                  return previous;
                }
                return updatedProfile;
              });
              setCharacters((previous) => {
                const hasMatch = previous.some((character) => character.id === updatedProfile.id);
                if (!hasMatch) {
                  return previous;
                }
                return previous.map((character) =>
                  character.id === updatedProfile.id ? updatedProfile : character,
                );
              });
            }
          }
        } catch (cityAssignmentError) {
          console.error("Unexpected error assigning default city", cityAssignmentError);
        } finally {
          assigningDefaultCityRef.current = false;
        }
      }

      const [
        skillsResult,
        attributesResult,
        walletResult,
        ledgerResult,
        cityResult,
        activitiesResult,
      ] = await Promise.all([
        supabase
          .from("player_skills")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("player_attributes")
          .select("*")
          .eq("profile_id", effectiveProfile.id)
          .maybeSingle(),
        supabase
          .from("player_xp_wallet")
          .select("*")
          .eq("profile_id", effectiveProfile.id)
          .maybeSingle(),
        supabase
          .from("experience_ledger")
          .select("*")
          .eq("profile_id", effectiveProfile.id)
          .order("created_at", { ascending: false })
          .limit(XP_LEDGER_FETCH_LIMIT),
        effectiveProfile.current_city_id
          ? supabase.from("cities").select("*").eq("id", effectiveProfile.current_city_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("activity_feed")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (skillsResult.error) {
        console.error("Failed to load player skills", skillsResult.error);
      }
      if (attributesResult.error) {
        console.error("Failed to load player attributes", attributesResult.error);
      }
      if (walletResult.error) {
        console.error("Failed to load XP wallet", walletResult.error);
      }
      if (ledgerResult.error) {
        console.error("Failed to load XP ledger", ledgerResult.error);
      }
      if (cityResult && cityResult.error) {
        console.error("Failed to load city", cityResult.error);
      }
      if (activitiesResult.error) {
        console.error("Failed to load activities", activitiesResult.error);
      }

      setSkills((skillsResult.data ?? null) as PlayerSkills);
      setAttributes(mapAttributes((attributesResult.data ?? null) as RawAttributes));
      setXpWallet((walletResult.data ?? null) as PlayerXpWallet);
      setXpLedger((ledgerResult.data ?? []) as ExperienceLedgerRow[]);
      setCurrentCity((cityResult?.data ?? null) as CityRow | null);
      setActivities((activitiesResult.data ?? []) as ActivityFeedRow[]);
      setSkillProgress([]);
      setUnlockedSkills({});
    },
    [user],
  );

  const fetchData = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setCharacters([]);
      setSelectedCharacterId(null);
      setSkills(null);
      setAttributes(null);
      setXpWallet(null);
      setXpLedger([]);
      setSkillProgress([]);
      setUnlockedSkills({});
      setActivities([]);
      setCurrentCity(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (profileError) {
        throw profileError;
      }

      const profileList = (data ?? []) as PlayerProfile[];
      setCharacters(profileList);

      const activeProfile = profileList.find((candidate) => candidate.id === selectedCharacterId) ?? profileList[0] ?? null;
      setProfile(activeProfile ?? null);
      setSelectedCharacterId(activeProfile?.id ?? null);

      await loadCharacterDetails(activeProfile ?? null);
    } catch (err) {
      console.error("Error fetching game data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch game data");
    } finally {
      setLoading(false);
    }
  }, [loadCharacterDetails, selectedCharacterId, user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!selectedCharacterId || !user) {
      setActivities([]);
      return;
    }

    const channel = supabase
      .channel(`activity_feed:user:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_feed",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newRow = payload.new as ActivityFeedRow;
          setActivities((previous) => {
            const withoutDuplicate = previous.filter((activity) => activity.id !== newRow.id);
            return [newRow, ...withoutDuplicate].slice(0, 20);
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedCharacterId, user]);

  const setActiveCharacter = useCallback(
    async (id: string) => {
      const nextProfile = characters.find((character) => character.id === id) ?? null;
      setProfile(nextProfile);
      setSelectedCharacterId(nextProfile?.id ?? null);
      await loadCharacterDetails(nextProfile ?? null);
    },
    [characters, loadCharacterDetails],
  );

  const createCharacter = useCallback(
    async (data: Partial<PlayerProfile>) => {
      if (!user) {
        throw new Error("You need to be signed in to create a character");
      }

      const payload: Database["public"]["Tables"]["profiles"]["Insert"] = {
        user_id: user.id,
        username: data.username ?? `performer_${Date.now()}`,
        display_name: data.display_name ?? data.username ?? "New Performer",
      };

      const { error: insertError } = await supabase.from("profiles").insert(payload);
      if (insertError) {
        throw insertError;
      }

      await fetchData();
    },
    [fetchData, user],
  );

  const resetCharacter = useCallback(async () => {
    if (!user) {
      throw new Error("Authentication required to reset character");
    }

    const { error } = await supabase.rpc("reset_player_character");
    if (error) {
      throw error;
    }

    await fetchData();
  }, [fetchData, user]);

  const updateProfile = useCallback(
    async (updates: ProfileUpdate) => {
      if (!profile) {
        throw new Error("No active profile selected");
      }

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profile.id)
        .select("*")
        .single();

      if (updateError) {
        throw updateError;
      }

      const updatedProfile = data as PlayerProfile;
      setProfile(updatedProfile);
      setCharacters((prev) => prev.map((character) => (character.id === updatedProfile.id ? updatedProfile : character)));
      await loadCharacterDetails(updatedProfile);
      return updatedProfile;
    },
    [loadCharacterDetails, profile],
  );

  const updateSkills = useCallback(
    async (updates: SkillsUpdate) => {
      if (!user) {
        throw new Error("Authentication required to update skills");
      }

      const payload: Database["public"]["Tables"]["player_skills"]["Insert"] = {
        user_id: user.id,
        ...updates,
      };

      const { data, error: upsertError } = await supabase
        .from("player_skills")
        .upsert(payload, { onConflict: "user_id" })
        .select("*")
        .maybeSingle();

      if (upsertError) {
        throw upsertError;
      }

      setSkills((data ?? null) as PlayerSkills);
      return (data ?? null) as PlayerSkills;
    },
    [user],
  );

  const updateAttributes = useCallback(
    async (updates: AttributesUpdate) => {
      if (!user) {
        throw new Error("Authentication required to update attributes");
      }

      if (!profile) {
        throw new Error("No active profile selected");
      }

      const payload: Database["public"]["Tables"]["player_attributes"]["Insert"] = {
        user_id: user.id,
        profile_id: profile.id,
      };

      for (const [category, column] of Object.entries(ATTRIBUTE_COLUMN_MAP) as Array<[
        AttributeCategory,
        keyof PlayerAttributesRow,
      ]>) {
        const value = updates[category];
        if (typeof value === "number" && Number.isFinite(value)) {
          payload[column] = value;
        }
      }

      const { data, error: upsertError } = await supabase
        .from("player_attributes")
        .upsert(payload, { onConflict: "profile_id" })
        .select("*")
        .maybeSingle();

      if (upsertError) {
        throw upsertError;
      }

      const mapped = mapAttributes((data ?? null) as RawAttributes);
      setAttributes(mapped);
      return mapped;
    },
    [profile, user],
  );

  const addActivity = useCallback(
    async (
      type: string,
      message: string,
      earnings: number | undefined = undefined,
      metadata: ActivityInsert["metadata"] = null,
    ) => {
      if (!user) {
        throw new Error("Authentication required to log activity");
      }

      const payload: ActivityInsert = {
        user_id: user.id,
        activity_type: type,
        message,
        earnings: typeof earnings === "number" ? earnings : null,
        metadata,
      };

      const { error: insertError } = await supabase.from("activity_feed").insert(payload);
      if (insertError) {
        throw insertError;
      }
    },
    [user],
  );

  const awardActionXp = useCallback(
    async (input: AwardActionXpInput) => {
      const response = await awardActionXpUtility(input);

      if (response.wallet) {
        setXpWallet(response.wallet as PlayerXpWallet);
      }

      if (response.profile) {
        setProfile((prev) => (prev && prev.id === response.profile.id ? { ...prev, ...response.profile } : prev));
      }
    },
    [],
  );

  const freshWeeklyBonusAvailable = useMemo(() => isWeeklyBonusFresh(xpLedger), [xpLedger]);

  const value: UseGameDataReturn = useMemo(
    () => ({
      profile,
      skills,
      attributes,
      xpWallet,
      xpLedger,
      skillProgress,
      unlockedSkills,
      activities,
      freshWeeklyBonusAvailable,
      currentCity,
      loading,
      error,
      characters,
      selectedCharacterId,
      hasCharacters: characters.length > 0,
      refetch: fetchData,
      refreshCharacters: fetchData,
      setActiveCharacter,
      createCharacter,
      resetCharacter,
      updateProfile,
      updateSkills,
      updateAttributes,
      addActivity,
      awardActionXp,
    }),
    [
      profile,
      skills,
      attributes,
      xpWallet,
      xpLedger,
      skillProgress,
      unlockedSkills,
      activities,
      freshWeeklyBonusAvailable,
      currentCity,
      loading,
      error,
      characters,
      selectedCharacterId,
      fetchData,
      setActiveCharacter,
      createCharacter,
      resetCharacter,
      updateProfile,
      updateSkills,
      updateAttributes,
      addActivity,
      awardActionXp,
    ],
  );

  return value;
};

export const GameDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};
