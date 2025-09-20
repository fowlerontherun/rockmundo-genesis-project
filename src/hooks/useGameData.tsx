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
export type ExperienceLedgerRow = any; // Will be updated when types regenerate
export type UnlockedSkillsMap = Record<string, boolean>;
export type ActivityFeedRow = Database["public"]["Tables"]["activity_feed"]["Row"];

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type SkillsUpdate = Database["public"]["Tables"]["player_skills"]["Update"];
type AttributesUpdate = Partial<PlayerAttributes>;
type XpWalletUpdate = Database["public"]["Tables"]["player_xp_wallet"]["Update"];
type XpWalletInsert = Database["public"]["Tables"]["player_xp_wallet"]["Insert"];
type ActivityInsert = Database["public"]["Tables"]["activity_feed"]["Insert"];
type CityRow = Database["public"]["Tables"]["cities"]["Row"];
type PlayerAttributesRow = Database["public"]["Tables"]["player_attributes"]["Row"];
type RawAttributes = PlayerAttributesRow | null;
type PlayerAttributesInsert = Database["public"]["Tables"]["player_attributes"]["Insert"];

export interface ProfileUpsertInput {
  name: string;
  stageName: string;
  bio: string;
  attributes?: Partial<PlayerAttributes>;
}

const ATTRIBUTE_COLUMNS: Array<keyof PlayerAttributesInsert> = [
  "business_acumen",
  "charisma",
  "creative_insight",
  "crowd_engagement",
  "looks",
  "marketing_savvy",
  "mental_focus",
  "musical_ability",
  "musicality",
  "physical_endurance",
  "rhythm_sense",
  "social_reach",
  "stage_presence",
  "technical_mastery",
  "vocal_talent",
];

const DEFAULT_ATTRIBUTE_SCORE = 5;

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
  refetch: () => Promise<void>;
  updateProfile: (updates: ProfileUpdate) => Promise<PlayerProfile>;
  updateSkills: (updates: SkillsUpdate) => Promise<PlayerSkills>;
  updateXpWallet: (updates: XpWalletUpdate) => Promise<PlayerXpWallet>;
  updateAttributes: (updates: AttributesUpdate) => Promise<PlayerAttributes | null>;
  addActivity: (type: string, message: string, earnings?: number, metadata?: ActivityInsert["metadata"]) => Promise<void>;
  awardActionXp: (input: AwardActionXpInput) => Promise<void>;
  upsertProfileWithDefaults: (
    input: ProfileUpsertInput,
  ) => Promise<{ profile: PlayerProfile; attributes: PlayerAttributes | null }>;
}

const ATTRIBUTE_CATEGORIES = Object.keys(ATTRIBUTE_COLUMN_MAP) as AttributeCategory[];

const createDefaultAttributes = (): PlayerAttributes =>
  ATTRIBUTE_CATEGORIES.reduce((accumulator, category) => {
    accumulator[category] = DEFAULT_ATTRIBUTE_SCORE;
    return accumulator;
  }, {} as PlayerAttributes);

const mapAttributes = (row: RawAttributes): PlayerAttributes => {
  const baseAttributes = createDefaultAttributes();

  if (!row) {
    return baseAttributes;
  }

  for (const [category, column] of Object.entries(ATTRIBUTE_COLUMN_MAP) as Array<[
    AttributeCategory,
    keyof PlayerAttributesRow,
  ]>) {
    const rawValue = row[column];
    const numericValue = typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : DEFAULT_ATTRIBUTE_SCORE;
    baseAttributes[category] = Math.max(DEFAULT_ATTRIBUTE_SCORE, numericValue);
  }

  return baseAttributes;
};

export const useGameData = (): UseGameDataReturn => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
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
  const defaultCityAssignmentDisabledRef = useRef(false);
  const isSchemaCacheMissingColumnError = (error: unknown): error is { code?: string } =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "PGRST204";

  const loadProfileDetails = useCallback(
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

      const profileSupportsCurrentCityId =
        effectiveProfile !== null && Object.prototype.hasOwnProperty.call(effectiveProfile, "current_city_id");

      if (!profileSupportsCurrentCityId && !defaultCityAssignmentDisabledRef.current && effectiveProfile) {
        defaultCityAssignmentDisabledRef.current = true;
        console.warn(
          "Skipping default city assignment - current_city_id column missing from profile payload; ensure migrations have run.",
          { profileId: effectiveProfile.id },
        );
      }

      if (
        profileSupportsCurrentCityId &&
        !effectiveProfile.current_city_id &&
        !assigningDefaultCityRef.current &&
        !defaultCityAssignmentDisabledRef.current
      ) {
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
              if (isSchemaCacheMissingColumnError(updateError)) {
                defaultCityAssignmentDisabledRef.current = true;
                console.warn(
                  "Skipping default city assignment - current_city_id column missing from schema cache",
                  updateError,
                );
              } else {
                console.error("Failed to assign London as default city", updateError);
              }
            } else if (updatedProfileData) {
              const updatedProfile = updatedProfileData as PlayerProfile;
              effectiveProfile = updatedProfile;
              setProfile((previous) => {
                if (previous && previous.id !== updatedProfile.id) {
                  return previous;
                }
                return updatedProfile;
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
          .eq("profile_id", effectiveProfile.id)
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
          .eq("profile_id", effectiveProfile.id)
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
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const nextProfile = (data as PlayerProfile | null) ?? null;
      setProfile(nextProfile);

      await loadProfileDetails(nextProfile);
    } catch (err) {
      console.error("Error fetching game data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch game data");
    } finally {
      setLoading(false);
    }
  }, [loadProfileDetails, user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!profile || !user) {
      setActivities([]);
      return;
    }

    const channel = supabase
      .channel(`activity_feed:profile:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_feed",
          filter: `profile_id=eq.${profile.id}`,
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
  }, [profile?.id, user?.id]);

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

  const upsertProfileWithDefaults = useCallback(
    async ({ name, stageName, bio, attributes: providedAttributes }: ProfileUpsertInput) => {
      if (!user) {
        throw new Error("Authentication required to update profile");
      }

      const trimmedName = name.trim();
      const trimmedStageName = stageName.trim();
      const trimmedBio = bio.trim();

      const fallbackUsername = `player-${user.id.slice(0, 8)}`;
      const rawUsername = trimmedName.length > 0 ? trimmedName : fallbackUsername;
      const normalizedUsername = rawUsername
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
      const username = normalizedUsername.length > 0 ? normalizedUsername : fallbackUsername;
      const displayName = trimmedStageName.length > 0 ? trimmedStageName : rawUsername;

      console.info("useGameData.profileUpsert.lookupCity.start", {
        city: "London",
        userId: user.id,
      });

      const { data: londonCity, error: londonCityError } = await supabase
        .from("cities")
        .select("id")
        .eq("name", "London")
        .maybeSingle();

      if (londonCityError) {
        console.error("useGameData.profileUpsert.lookupCity.error", {
          city: "London",
          userId: user.id,
          error: londonCityError,
        });
        throw londonCityError;
      }

      if (!londonCity?.id) {
        console.error("useGameData.profileUpsert.lookupCity.missing", {
          city: "London",
          userId: user.id,
        });
        throw new Error("Unable to locate London in the cities table");
      }

      console.info("useGameData.profileUpsert.lookupCity.success", {
        city: "London",
        userId: user.id,
        cityId: londonCity.id,
      });

      const currentLocationLabel = "London";
      const baseProfilePayload: Pick<
        Database["public"]["Tables"]["profiles"]["Insert"],
        "username" | "display_name" | "bio" | "current_city_id" | "current_city" | "current_location"
      > = {
        username,
        display_name: displayName,
        bio: trimmedBio,
        current_city_id: londonCity.id,
        current_city: londonCity.id,
        current_location: currentLocationLabel,
      };

      let nextProfile: PlayerProfile;

      if (profile) {
        const updates: Database["public"]["Tables"]["profiles"]["Update"] = baseProfilePayload;
        console.info("useGameData.profileUpsert.profileMutation.start", {
          mode: "update",
          profileId: profile.id,
          userId: user.id,
        });

        const { data, error: updateError } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", profile.id)
          .select("*")
          .single();

        if (updateError) {
          console.error("useGameData.profileUpsert.profileMutation.error", {
            mode: "update",
            profileId: profile.id,
            userId: user.id,
            error: updateError,
          });
          throw updateError;
        }

        nextProfile = data as PlayerProfile;

        console.info("useGameData.profileUpsert.profileMutation.success", {
          mode: "update",
          profileId: nextProfile.id,
          userId: user.id,
        });
      } else {
        const insertPayload: Database["public"]["Tables"]["profiles"]["Insert"] = {
          ...baseProfilePayload,
          user_id: user.id,
          slot_number: 1,
          is_active: true,
        };

        console.info("useGameData.profileUpsert.profileMutation.start", {
          mode: "insert",
          userId: user.id,
        });

        const { data, error: insertError } = await supabase
          .from("profiles")
          .insert(insertPayload)
          .select("*")
          .single();

        if (insertError) {
          console.error("useGameData.profileUpsert.profileMutation.error", {
            mode: "insert",
            userId: user.id,
            error: insertError,
          });
          throw insertError;
        }

        nextProfile = data as PlayerProfile;

        console.info("useGameData.profileUpsert.profileMutation.success", {
          mode: "insert",
          profileId: nextProfile.id,
          userId: user.id,
        });
      }

      const { data: existingAttributesRow, error: existingAttributesError } = await supabase
        .from("player_attributes")
        .select("*")
        .eq("profile_id", nextProfile.id)
        .maybeSingle();

      if (existingAttributesError) {
        console.error("useGameData.profileUpsert.attributeFetch.error", {
          profileId: nextProfile.id,
          userId: user.id,
          error: existingAttributesError,
        });
        throw existingAttributesError;
      }

      const hasProvidedAttributes =
        providedAttributes !== undefined && Object.keys(providedAttributes).length > 0;

      let mappedAttributes: PlayerAttributes | null = null;

      if (!existingAttributesRow) {
        const attributePayload: PlayerAttributesInsert = {
          user_id: user.id,
          profile_id: nextProfile.id,
          attribute_points: 0,
          attribute_points_spent: 0,
        };

        for (const column of ATTRIBUTE_COLUMNS) {
          attributePayload[column] = DEFAULT_ATTRIBUTE_SCORE;
        }

        if (providedAttributes) {
          for (const [category, column] of Object.entries(ATTRIBUTE_COLUMN_MAP) as Array<[
            AttributeCategory,
            keyof PlayerAttributesRow,
          ]>) {
            const value = providedAttributes[category];
            if (typeof value === "number" && Number.isFinite(value)) {
              attributePayload[column] = value;
            }
          }
        }

        console.info("useGameData.profileUpsert.attributeMutation.start", {
          profileId: nextProfile.id,
          userId: user.id,
          mode: "seed",
        });

        const { data: attributeData, error: attributeError } = await supabase
          .from("player_attributes")
          .upsert(attributePayload, { onConflict: "profile_id" })
          .select("*")
          .maybeSingle();

        if (attributeError) {
          console.error("useGameData.profileUpsert.attributeMutation.error", {
            profileId: nextProfile.id,
            userId: user.id,
            mode: "seed",
            error: attributeError,
          });
          throw attributeError;
        }

        console.info("useGameData.profileUpsert.attributeMutation.success", {
          profileId: nextProfile.id,
          userId: user.id,
          mode: "seed",
        });

        mappedAttributes = mapAttributes((attributeData ?? null) as RawAttributes);
      } else {
        mappedAttributes = mapAttributes((existingAttributesRow ?? null) as RawAttributes);

        if (hasProvidedAttributes) {
          console.info("useGameData.profileUpsert.attributeMutation.start", {
            profileId: nextProfile.id,
            userId: user.id,
            mode: "update",
          });

          try {
            const updatedAttributes = await updateAttributes(providedAttributes);
            if (updatedAttributes) {
              mappedAttributes = updatedAttributes;
            }

            console.info("useGameData.profileUpsert.attributeMutation.success", {
              profileId: nextProfile.id,
              userId: user.id,
              mode: "update",
            });
          } catch (attributeUpdateError) {
            console.error("useGameData.profileUpsert.attributeMutation.error", {
              profileId: nextProfile.id,
              userId: user.id,
              mode: "update",
              error: attributeUpdateError,
            });
            throw attributeUpdateError;
          }
        }
      }

      setProfile(nextProfile);
      setAttributes(mappedAttributes);
      await loadProfileDetails(nextProfile);

      return { profile: nextProfile, attributes: mappedAttributes };
    },
    [loadProfileDetails, profile, updateAttributes, user],
  );

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
      await loadProfileDetails(updatedProfile);
      return updatedProfile;
    },
    [loadProfileDetails, profile],
  );

  const updateSkills = useCallback(
    async (updates: SkillsUpdate) => {
      if (!user) {
        throw new Error("Authentication required to update skills");
      }

      if (!profile) {
        throw new Error("No active profile selected");
      }

      const payload: Database["public"]["Tables"]["player_skills"]["Insert"] = {
        profile_id: profile.id,
        user_id: user.id,
        ...updates,
      };

      payload.profile_id = profile.id;
      payload.user_id = user.id;

      const { data, error: upsertError } = await supabase
        .from("player_skills")
        .upsert(payload, { onConflict: "profile_id" })
        .select("*")
        .maybeSingle();

      if (upsertError) {
        throw upsertError;
      }

      setSkills((data ?? null) as PlayerSkills);
      return (data ?? null) as PlayerSkills;
    },
    [profile, user],
  );

  const updateXpWallet = useCallback(
    async (updates: XpWalletUpdate) => {
      if (!profile) {
        throw new Error("No active profile selected");
      }

      const payload: XpWalletInsert = {
        profile_id: profile.id,
        ...updates,
      };

      const { data, error: upsertError } = await supabase
        .from("player_xp_wallet")
        .upsert(payload, { onConflict: "profile_id" })
        .select("*")
        .maybeSingle();

      if (upsertError) {
        throw upsertError;
      }

      setXpWallet((data ?? null) as PlayerXpWallet);
      return (data ?? null) as PlayerXpWallet;
    },
    [profile],
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

      if (!profile) {
        throw new Error("No active profile selected");
      }

      const payload: ActivityInsert = {
        user_id: user.id,
        profile_id: profile.id,
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
    [profile, user],
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
      refetch: fetchData,
      updateProfile,
      updateSkills,
      updateXpWallet,
      updateAttributes,
      addActivity,
      awardActionXp,
      upsertProfileWithDefaults,
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
      fetchData,
      updateProfile,
      updateSkills,
      updateXpWallet,
      updateAttributes,
      addActivity,
      awardActionXp,
      upsertProfileWithDefaults,
    ],
  );

  return value;
};

export const GameDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};
