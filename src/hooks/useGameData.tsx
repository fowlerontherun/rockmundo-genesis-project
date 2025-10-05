import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";
import { useAuth } from "@/hooks/use-auth-context";
import {
  awardActionXp as awardActionXpUtility,
  claimDailyXp as claimDailyXpUtility,
  spendAttributeXp as spendAttributeXpUtility,
  spendSkillXp as spendSkillXpUtility,
  type AwardActionXpInput,
  type SpendAttributeXpInput,
  type SpendSkillXpInput,
} from "@/utils/progression";

export type PlayerProfile = Database["public"]["Tables"]["profiles"]["Row"];
export type PlayerSkills = Partial<Record<string, number>>;
type AttributeCategory =
  | "creativity"
  | "technical"
  | "charisma"
  | "looks"
  | "mental_focus"
  | "musicality"
  | "physical_endurance"
  | "stage_presence"
  | "crowd_engagement"
  | "social_reach";

export type PlayerAttributes = Record<AttributeCategory, number>;
export type PlayerXpWallet = Database["public"]["Tables"]["player_xp_wallet"]["Row"] | null;
export type SkillProgressRow = Database["public"]["Tables"]["skill_progress"]["Row"];
export type ExperienceLedgerRow = any; // Will be updated when types regenerate
export type UnlockedSkillsMap = Record<string, boolean>;
export type ActivityFeedRow = Database["public"]["Tables"]["activity_feed"]["Row"];
type ProfileActivityStatusRow = Database["public"]["Tables"]["profile_activity_statuses"]["Row"];
export type ProfileActivityStatus = Database["public"]["Tables"]["profile_activity_statuses"]["Row"];
type ProfileActivityStatusInsert = Database["public"]["Tables"]["profile_activity_statuses"]["Insert"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type SkillsUpdate = Record<string, number | null | undefined>;
type AttributesUpdate = Partial<PlayerAttributes>;
type XpWalletUpdate = Database["public"]["Tables"]["player_xp_wallet"]["Update"];
type XpWalletInsert = Database["public"]["Tables"]["player_xp_wallet"]["Insert"];
type ActivityInsert = Database["public"]["Tables"]["activity_feed"]["Insert"];
type ActivityInsertPayload = {
  activity_type: string;
  message: string;
  user_id: string;
  earnings?: number | null;
  metadata?: Record<string, any>;
  status?: string | null;
  duration_minutes?: number | null;
  status_id?: string | null;
  profile_id?: string;
};
type CityRow = Database["public"]["Tables"]["cities"]["Row"];
type PlayerAttributesRow = Database["public"]["Tables"]["player_attributes"]["Row"];
type PlayerSkillsRow = Database["public"]["Tables"]["player_skills"]["Row"];
type RawAttributes = PlayerAttributesRow | null;
type PlayerAttributesInsert = Database["public"]["Tables"]["player_attributes"]["Insert"];
type DailyXpGrantRow = Database["public"]["Tables"]["profile_daily_xp_grants"]["Row"];

export interface ProfileUpsertInput {
  name: string;
  stageName: string;
  bio: string;
  attributes?: Partial<PlayerAttributes>;
}

interface AddActivityOptions {
  status?: string | null;
  durationMinutes?: number | null;
  statusId?: string | null;
}

interface StartActivityInput {
  status: string;
  durationMinutes?: number | null;
  metadata?: Record<string, unknown> | null;
}

const ATTRIBUTE_COLUMNS: Array<keyof PlayerAttributesInsert> = [
  "charisma",
  "creative_insight",
  "crowd_engagement",
  "looks",
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
  technical: "technical_mastery",
  charisma: "charisma",
  looks: "looks",
  mental_focus: "mental_focus",
  musicality: "musicality",
  physical_endurance: "physical_endurance",
  stage_presence: "stage_presence",
  crowd_engagement: "crowd_engagement",
  social_reach: "social_reach",
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
  skills: PlayerSkills | null;
  attributes: PlayerAttributes | null;
  xpWallet: PlayerXpWallet;
  xpLedger: ExperienceLedgerRow[];
  skillProgress: SkillProgressRow[];
  unlockedSkills: UnlockedSkillsMap;
  activities: ActivityFeedRow[];
  activityStatus: ProfileActivityStatusRow | null;
  dailyXpGrant: DailyXpGrantRow | null;
  freshWeeklyBonusAvailable: boolean;
  currentCity: CityRow | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateProfile: (updates: ProfileUpdate) => Promise<PlayerProfile>;
  updateSkills: (updates: SkillsUpdate) => Promise<PlayerSkills>;
  updateXpWallet: (updates: XpWalletUpdate) => Promise<PlayerXpWallet>;
  updateAttributes: (updates: AttributesUpdate) => Promise<PlayerAttributes | null>;
  addActivity: (
    type: string,
    message: string,
    earnings?: number,
    metadata?: ActivityInsert["metadata"],
    options?: AddActivityOptions,
  ) => Promise<void>;
  refreshActivityStatus: () => Promise<ProfileActivityStatusRow | null>;
  startActivity: (input: StartActivityInput) => Promise<ProfileActivityStatusRow | null>;
  clearActivityStatus: () => Promise<void>;
  awardActionXp: (input: AwardActionXpInput) => Promise<void>;
  claimDailyXp: (metadata?: Record<string, unknown>) => Promise<void>;
  spendAttributeXp: (input: SpendAttributeXpInput) => Promise<void>;
  spendSkillXp: (input: SpendSkillXpInput) => Promise<void>;
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

const LEGACY_SKILL_KEYS = [
  "vocals",
  "guitar",
  "bass",
  "drums",
  "songwriting",
  "performance",
  "creativity",
  "technical",
  "composition",
] as const;

const LEGACY_SKILL_KEY_SET = new Set<string>(LEGACY_SKILL_KEYS);
const FALLBACK_SKILL_VALUE = 0;

const createDefaultSkills = (): PlayerSkills => {
  const base: PlayerSkills = {};
  for (const key of LEGACY_SKILL_KEYS) {
    base[key] = FALLBACK_SKILL_VALUE;
  }
  return base;
};

const normalizeSkillSlug = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const resolveLegacySkillKey = (slug: string): string | null => {
  if (LEGACY_SKILL_KEY_SET.has(slug)) {
    return slug;
  }

  const [prefix] = slug.split(/[_-]/);
  if (prefix && LEGACY_SKILL_KEY_SET.has(prefix)) {
    return prefix;
  }

  return null;
};

const coerceSkillValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }

  return null;
};

const deriveSkillsFromProgress = (
  progress: SkillProgressRow[],
  fallback: PlayerSkills | null,
): PlayerSkills => {
  const base: PlayerSkills = { ...(fallback ?? createDefaultSkills()) };

  for (const key of LEGACY_SKILL_KEYS) {
    if (typeof base[key] !== "number" || !Number.isFinite(base[key])) {
      base[key] = FALLBACK_SKILL_VALUE;
    }
  }

  for (const row of progress) {
    const slug = normalizeSkillSlug(row.skill_slug);
    if (!slug) {
      continue;
    }

    const numericValue =
      coerceSkillValue(row.current_level) ??
      coerceSkillValue((row.metadata as Record<string, unknown> | null | undefined)?.current_level);

    if (numericValue == null) {
      continue;
    }

    base[slug] = numericValue;

    const legacyKey = resolveLegacySkillKey(slug);
    if (legacyKey) {
      const previous =
        typeof base[legacyKey] === "number" && Number.isFinite(base[legacyKey])
          ? (base[legacyKey] as number)
          : FALLBACK_SKILL_VALUE;
      base[legacyKey] = Math.max(previous, numericValue);
    }
  }

  return base;
};

const deriveSkillsFromLegacyRow = (row: PlayerSkillsRow | null | undefined): PlayerSkills | null => {
  if (!row) {
    return null;
  }

  const base = createDefaultSkills();
  let mutated = false;

  for (const [key, rawValue] of Object.entries(row)) {
    const slug = normalizeSkillSlug(key);
    if (!slug) {
      continue;
    }

    const numericValue = coerceSkillValue(rawValue);
    if (numericValue == null) {
      continue;
    }

    base[slug] = numericValue;
    mutated = true;

    const legacyKey = resolveLegacySkillKey(slug);
    if (legacyKey) {
      const previous =
        typeof base[legacyKey] === "number" && Number.isFinite(base[legacyKey])
          ? (base[legacyKey] as number)
          : FALLBACK_SKILL_VALUE;
      base[legacyKey] = Math.max(previous, numericValue);
    }
  }

  return mutated ? base : null;
};

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

const GameDataContext = createContext<UseGameDataReturn | undefined>(undefined);

export const useOptionalGameData = (): UseGameDataReturn | undefined =>
  useContext(GameDataContext);

const useProvideGameData = (): UseGameDataReturn => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [attributes, setAttributes] = useState<PlayerAttributes | null>(null);
  const [xpWallet, setXpWallet] = useState<PlayerXpWallet>(null);
  const [xpLedger, setXpLedger] = useState<ExperienceLedgerRow[]>([]);
  const [skillProgress, setSkillProgress] = useState<SkillProgressRow[]>([]);
  const [unlockedSkills, setUnlockedSkills] = useState<UnlockedSkillsMap>({});
  const [activities, setActivities] = useState<ActivityFeedRow[]>([]);
  const [activityStatus, setActivityStatus] = useState<ProfileActivityStatusRow | null>(null);
  const [dailyXpGrant, setDailyXpGrant] = useState<DailyXpGrantRow | null>(null);
  const [currentCity, setCurrentCity] = useState<CityRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportsActivityProfileFilter, setSupportsActivityProfileFilter] = useState(true);
  const [activityFeedSupportsProfileId, setActivityFeedSupportsProfileId] = useState(true);
  const assigningDefaultCityRef = useRef(false);
  const defaultCityAssignmentDisabledRef = useRef(false);
  const dailyXpGrantTableAvailableRef = useRef(true);
  const activityStatusTableAvailableRef = useRef(true);
  const activityStatusWarningLoggedRef = useRef(false);
  const activityStatusMetadataSupportedRef = useRef(true);
  const activityFeedSupportsDurationRef = useRef(true);

  const getPostgrestErrorCode = (error: unknown): string | null => {
    if (typeof error !== "object" || error === null || !("code" in error)) {
      return null;
    }

    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  };

  const isSchemaCacheMissingColumnError = (error: unknown): error is { code?: string } =>
    getPostgrestErrorCode(error) === "PGRST204";

  const isRelationNotFoundError = (error: unknown): error is { code?: string } => {
    const code = getPostgrestErrorCode(error);
    return code === "PGRST116" || code === "42P01";
  };

  const isSchemaCacheMissingTableError = (
    error: unknown,
    tableName: string = "profile_daily_xp_grants",
  ): error is {
    code?: string;
    message?: string | null;
    details?: string | null;
  } => {
    const code = getPostgrestErrorCode(error);
    if (code === "PGRST201" || code === "PGRST202" || code === "PGRST205") {
      return true;
    }

    if (typeof error !== "object" || error === null) {
      return false;
    }

    const candidate = error as { code?: string; message?: string | null; details?: string | null };
    const haystack = [candidate.message, candidate.details]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();

    if (haystack.includes(tableName.toLowerCase())) {
      if (haystack.includes("schema cache") || haystack.includes("does not exist") || haystack.includes("not found")) {
        return true;
      }
    }

    return false;
  };

  const isMissingColumnError = (
    error: unknown,
    columnName: string,
  ): error is {
    code?: string;
    message?: string | null;
    details?: string | null;
  } => {
    if (typeof error !== "object" || error === null) {
      return false;
    }

    const candidate = error as { code?: string; message?: string | null; details?: string | null };
    const haystack = [candidate.message, candidate.details]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(columnName.toLowerCase())) {
      return false;
    }

    if (isSchemaCacheMissingColumnError(candidate)) {
      return true;
    }

    const code = getPostgrestErrorCode(candidate);
    if (code === "42703") {
      return true;
    }

    if (haystack.includes("column") || haystack.includes("schema cache")) {
      return true;
    }

    return false;
  };

  const isActivityFeedMissingProfileIdError = (
    error: unknown,
  ): error is { code?: string; message?: string | null; details?: string | null } => {
    if (isSchemaCacheMissingColumnError(error)) {
      return true;
    }

    const code = getPostgrestErrorCode(error);
    if (code === "42703") {
      return true;
    }

    if (typeof error !== "object" || error === null) {
      return false;
    }

    const candidate = error as { message?: string | null; details?: string | null };
    const haystack = [candidate.message, candidate.details]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();

    if (!haystack) {
      return false;
    }

    return haystack.includes("profile_id");
  };

  const isMissingTableResponse = (
    status: number | null | undefined,
    error: unknown,
    tableName: string,
  ): boolean => {
    if (status === 404) {
      return true;
    }

    if (!error) {
      return false;
    }

    return isRelationNotFoundError(error) || isSchemaCacheMissingTableError(error, tableName);
  };

  const logActivityStatusTableUnavailable = (debugInfo: unknown) => {
    activityStatusTableAvailableRef.current = false;

    if (activityStatusWarningLoggedRef.current) {
      return;
    }

    activityStatusWarningLoggedRef.current = true;
    console.warn("Profile activity status table is unavailable; skipping future queries", debugInfo);
  };


  const sanitizeActivityFeedRows = useCallback(
    (
      rows: ActivityFeedRow[] | null | undefined,
      fallbackProfileId: string,
    ): { rows: ActivityFeedRow[]; missingProfileId: boolean } => {
      if (!Array.isArray(rows)) {
        return { rows: [], missingProfileId: false };
      }

      let missingProfileId = false;
      let missingDurationColumn = false;

      const normalized = rows.map((row) => {
        const record = row as ActivityFeedRow & {
          profile_id?: string | null;
          duration_minutes?: number | null;
        };
        if (!record.profile_id) {
          missingProfileId = true;
        }

        if (!("duration_minutes" in record)) {
          missingDurationColumn = true;
        }

        return {
          ...record,
          profile_id: record.profile_id ?? fallbackProfileId,
          duration_minutes:
            "duration_minutes" in record && typeof record.duration_minutes !== "undefined"
              ? record.duration_minutes ?? null
              : null,
        };
      });

      if (missingDurationColumn && activityFeedSupportsDurationRef.current) {
        activityFeedSupportsDurationRef.current = false;
        console.warn(
          "Activity feed duration_minutes column is unavailable; omitting duration metadata from future entries.",
        );
      }

      return { rows: normalized, missingProfileId };
    },
    [activityFeedSupportsDurationRef],
  );

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
        setActivityStatus(null);
        setCurrentCity(null);
        setDailyXpGrant(null);
        setSupportsActivityProfileFilter(false);
        setActivityStatus(null);
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
        !(effectiveProfile as any).current_city_id &&
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
              .update({ current_city_id: londonCity.id } as any)
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

      const fetchPlayerSkillsForProfile = async () => {
        const result = await supabase
          .from("player_skills")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!result.error) {
          return result;
        }

        if (isRelationNotFoundError(result.error) || isSchemaCacheMissingColumnError(result.error) || isSchemaCacheMissingTableError(result.error)) {
          console.info(
            "Falling back to legacy player_skills scope due to schema mismatch",
            result.error,
          );

          const legacyResult = await supabase
            .from("player_skills")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (legacyResult.error) {
            if (isRelationNotFoundError(legacyResult.error) || isSchemaCacheMissingTableError(legacyResult.error)) {
              console.warn("Player skills table is unavailable; continuing with default skill state", legacyResult.error);
              return {
                data: null,
                error: null,
                count: null,
                status: 200,
                statusText: "OK",
              } as PostgrestSingleResponse<PlayerSkillsRow>;
            }

            return legacyResult;
          }

          const dataWithProfile = legacyResult.data
            ? ({
                ...(legacyResult.data as any),
                profile_id:
                  (legacyResult.data as any).profile_id ?? effectiveProfile.id,
              } as any)
            : legacyResult.data;

          return {
            ...legacyResult,
            data: dataWithProfile,
          };
        }

        return result;
      };

      const fetchActivitiesWithFallback = async () => {
        if (!activityFeedSupportsProfileId) {
          setSupportsActivityProfileFilter(false);
          return supabase
            .from("activity_feed")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20);
        }

        const result = await supabase
          .from("activity_feed")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (!result.error) {
          setSupportsActivityProfileFilter(true);
          return result;
        }

        if (isActivityFeedMissingProfileIdError(result.error)) {
          setSupportsActivityProfileFilter(false);
          setActivityFeedSupportsProfileId(false);

          return supabase
            .from("activity_feed")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20);
        }

        return result;
      };

      const skillProgressPromise = supabase
        .from("skill_progress")
        .select("*")
        .eq("profile_id", effectiveProfile.id)
        .order("current_level", { ascending: false, nullsFirst: false })
        .order("current_xp", { ascending: false, nullsFirst: false });

      const attributesPromise = supabase
        .from("player_attributes")
        .select("*")
        .eq("profile_id", effectiveProfile.id)
        .maybeSingle();

      const walletPromise = supabase
        .from("player_xp_wallet")
        .select("*")
        .eq("profile_id", effectiveProfile.id)
        .maybeSingle();

      const ledgerPromise = supabase
        .from("experience_ledger")
        .select("*")
        .eq("profile_id", effectiveProfile.id)
        .order("created_at", { ascending: false })
        .limit(XP_LEDGER_FETCH_LIMIT);

      const cityPromise = (effectiveProfile as any).current_city_id
        ? supabase.from("cities").select("*").eq("id", (effectiveProfile as any).current_city_id).maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const activitiesPromise = fetchActivitiesWithFallback();

  const activityStatusPromise: Promise<PostgrestSingleResponse<ProfileActivityStatusRow | null>> =
    activityStatusTableAvailableRef.current
      ? (Promise.resolve(
          supabase
            .from("profile_activity_statuses")
            .select("*")
            .eq("profile_id", effectiveProfile.id)
            .maybeSingle(),
        ) as Promise<PostgrestSingleResponse<ProfileActivityStatusRow | null>>)
      : Promise.resolve({
          data: null,
          error: null,
          count: null,
          status: 200,
          statusText: "OK",
        } as PostgrestSingleResponse<ProfileActivityStatusRow | null>);


      const scopedActivitiesPromise = (() => {
        try {
          let activityFeedQuery = supabase
            .from("activity_feed")
            .select("*")
            .eq("user_id", user.id);

          // Skip profile_id filtering to avoid type issues
          // if (activityFeedSupportsProfileId && effectiveProfile?.id) {
          //   activityFeedQuery = activityFeedQuery.eq("profile_id", effectiveProfile.id);
          // }

          return activityFeedQuery.order("created_at", { ascending: false }).limit(20);
        } catch (error) {
          console.error("Error querying activities:", error);
          return Promise.resolve({ data: [], error: null });
        }
      })();

      const skillProgressResult = await skillProgressPromise;

      let legacySkillsFallback: PlayerSkills | null = null;
      let skillProgressErrorToLog: unknown = null;

      const resolvedSkillProgress = (skillProgressResult.data ?? []) as SkillProgressRow[];

      let shouldFetchLegacySkills = false;
      if (skillProgressResult.error) {
        if (
          isRelationNotFoundError(skillProgressResult.error) ||
          isSchemaCacheMissingColumnError(skillProgressResult.error) ||
          isSchemaCacheMissingTableError(skillProgressResult.error, "skill_progress")
        ) {
          shouldFetchLegacySkills = true;
        } else {
          skillProgressErrorToLog = skillProgressResult.error;
        }
      } else if (resolvedSkillProgress.length === 0) {
        shouldFetchLegacySkills = true;
      }

      if (shouldFetchLegacySkills) {
        const legacyResult = await fetchPlayerSkillsForProfile();
        if (legacyResult.error) {
          if (
            !isRelationNotFoundError(legacyResult.error) &&
            !isSchemaCacheMissingTableError(legacyResult.error)
          ) {
            skillProgressErrorToLog = legacyResult.error;
          }
        } else {
          legacySkillsFallback = deriveSkillsFromLegacyRow(
            (legacyResult.data ?? null) as PlayerSkillsRow | null,
          );
        }
      }

      const [
        attributesResult,
        walletResult,
        ledgerResult,
        cityResult,
        activitiesResult,
        activityStatusResult,
      ] = await Promise.all([
        attributesPromise,
        walletPromise,
        ledgerPromise,
        cityPromise,
        activitiesPromise,
        activityStatusPromise,
      ]);

      await scopedActivitiesPromise;

      let dailyGrantResult: PostgrestSingleResponse<DailyXpGrantRow | null>;
      if (dailyXpGrantTableAvailableRef.current) {
        dailyGrantResult = await supabase
          .from("profile_daily_xp_grants")
          .select("*")
          .eq("profile_id", effectiveProfile.id)
          .order("grant_date", { ascending: false })
          .limit(1)
          .maybeSingle();
      } else {
        dailyGrantResult = {
          data: null,
          error: null,
          count: null,
          status: 200,
          statusText: "OK",
        } as PostgrestSingleResponse<DailyXpGrantRow | null>;
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
      if (skillProgressErrorToLog) {
        console.error("Failed to load skill progress", skillProgressErrorToLog);
      }
      if (dailyGrantResult.error) {
        if (isSchemaCacheMissingTableError(dailyGrantResult.error)) {
          dailyXpGrantTableAvailableRef.current = false;
          console.warn("Daily XP grant table is unavailable; skipping future queries", dailyGrantResult.error);
        } else if (dailyGrantResult.error && typeof dailyGrantResult.error === 'object' && dailyGrantResult.error && 'code' in dailyGrantResult.error && (dailyGrantResult.error as any).code !== "PGRST116") {
          console.error("Failed to load daily XP grant", dailyGrantResult.error);
        }
      }

      const activityStatusUnavailable = isMissingTableResponse(
        activityStatusResult.status,
        activityStatusResult.error,
        "profile_activity_statuses",
      );

      if (activityStatusUnavailable) {
        const debugInfo =
          activityStatusResult.error ?? {
            status: activityStatusResult.status,
            statusText: activityStatusResult.statusText,
          };

        logActivityStatusTableUnavailable(debugInfo);
        setActivityStatus(null);
      } else if (activityStatusResult.error) {
        const errorCode =
          typeof activityStatusResult.error === "object" &&
          activityStatusResult.error &&
          "code" in activityStatusResult.error
            ? (activityStatusResult.error as { code?: string }).code
            : undefined;

        if (errorCode === "PGRST116") {
          setActivityStatus(null);
        } else {
          console.error("Failed to load activity status", activityStatusResult.error);
        }
      } else {
        activityStatusTableAvailableRef.current = true;
        activityStatusWarningLoggedRef.current = false;
        setActivityStatus((activityStatusResult.data ?? null) as ProfileActivityStatusRow | null);
      }

      let nextActivities: ActivityFeedRow[] = [];

      if (activitiesResult.error) {
        if (isActivityFeedMissingProfileIdError(activitiesResult.error)) {
          if (activityFeedSupportsProfileId) {
            setActivityFeedSupportsProfileId(false);
          }

          const fallbackResult = await supabase
            .from("activity_feed")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20);

          if (fallbackResult.error) {
            console.error("Failed to load activities", fallbackResult.error);
          } else {
            const { rows, missingProfileId } = sanitizeActivityFeedRows(
              fallbackResult.data as ActivityFeedRow[] | null,
              effectiveProfile.id,
            );

            if (missingProfileId && activityFeedSupportsProfileId) {
              setActivityFeedSupportsProfileId(false);
            }

            nextActivities = rows;
          }
        } else {
          console.error("Failed to load activities", activitiesResult.error);
        }
      } else {
        const { rows, missingProfileId } = sanitizeActivityFeedRows(
          activitiesResult.data as ActivityFeedRow[] | null,
          effectiveProfile.id,
        );

        if (missingProfileId && activityFeedSupportsProfileId) {
          setActivityFeedSupportsProfileId(false);
        }

        nextActivities = rows;
      }

      setSkillProgress(resolvedSkillProgress);
      const fallbackSkills = legacySkillsFallback;
      setSkills((previous) =>
        deriveSkillsFromProgress(resolvedSkillProgress, fallbackSkills ?? previous),
      );
      setAttributes(mapAttributes((attributesResult.data ?? null) as RawAttributes));
      setXpWallet((walletResult.data ?? null) as PlayerXpWallet);
      setXpLedger((ledgerResult.data ?? []) as ExperienceLedgerRow[]);
      setCurrentCity((cityResult?.data ?? null) as CityRow | null);
      setActivities(nextActivities);

      setUnlockedSkills({});
      const grantRow =
        dailyGrantResult.error && isSchemaCacheMissingTableError(dailyGrantResult.error)
          ? null
          : dailyGrantResult.data
            ? (dailyGrantResult.data as DailyXpGrantRow)
            : null;
      setDailyXpGrant(grantRow);
    },
    [activityFeedSupportsProfileId, sanitizeActivityFeedRows, user],
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
      setActivityStatus(null);
      setCurrentCity(null);
      setDailyXpGrant(null);
      setSupportsActivityProfileFilter(false);
      setLoading(false);
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

    const filterColumn = supportsActivityProfileFilter ? "profile_id" : "user_id";
    const filterValue = supportsActivityProfileFilter ? profile.id : user.id;

    const channel = supabase
      .channel(`activity_feed:${filterColumn}:${filterValue}`)

      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_feed",
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        (payload) => {
          const { rows } = sanitizeActivityFeedRows([payload.new as ActivityFeedRow], profile.id);
          const [newRow] = rows;
          if (!newRow) {
            return;
          }

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
  }, [profile?.id, supportsActivityProfileFilter, user?.id]);

  useEffect(() => {
    const profileId = profile?.id;

    if (!profileId) {
      setActivityStatus(null);
      return;
    }

    if (!activityStatusTableAvailableRef.current) {
      return;
    }

    const channel = supabase
      .channel(`profile_activity_statuses:profile_id:${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profile_activity_statuses",
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setActivityStatus(null);
            return;
          }

          const nextStatus = (payload.new ?? null) as ProfileActivityStatus | null;
          setActivityStatus(nextStatus);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id]);


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
          (payload as any)[column] = value;
        }
      }

      const { data, error: upsertError } = await supabase
        .from("player_attributes")
        .upsert(payload as any, { onConflict: "profile_id" })
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
      const baseProfilePayload: any = {
        username,
        display_name: displayName,
        bio: trimmedBio,
        current_city_id: londonCity.id,
        current_city: londonCity.id,
        current_location: currentLocationLabel,
      };

      let nextProfile: PlayerProfile;

      if (profile) {
        const updates: any = baseProfilePayload;
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
        const insertPayload: any = {
          ...baseProfilePayload,
          user_id: user.id,
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
        const attributePayload: any = {
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
        .update(updates as any)
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

      const normalizedEntries = Object.entries(updates ?? {})
        .map(([key, value]) => ({ slug: normalizeSkillSlug(key), value: coerceSkillValue(value) }))
        .filter((entry): entry is { slug: string; value: number } => Boolean(entry.slug) && entry.value !== null);

      if (normalizedEntries.length === 0) {
        return skills ?? createDefaultSkills();
      }

      const timestamp = new Date().toISOString();
      const payloads = normalizedEntries.map(({ slug, value }) => ({
        profile_id: profile.id,
        skill_slug: slug,
        current_level: value,
        last_practiced_at: timestamp,
      }));

      const { data, error: upsertError } = await supabase
        .from("skill_progress")
        .upsert(payloads as any, { onConflict: "profile_id,skill_slug" })
        .select("*");

      if (upsertError) {
        throw upsertError;
      }

      const rows = (data ?? []) as SkillProgressRow[];

      let nextSkillProgressState: SkillProgressRow[] = [];
      setSkillProgress((current) => {
        const map = new Map<string, SkillProgressRow>();
        for (const row of current) {
          if (row?.skill_slug) {
            map.set(row.skill_slug, row);
          }
        }

        for (const row of rows) {
          if (row?.skill_slug) {
            map.set(row.skill_slug, row);
          }
        }

        nextSkillProgressState = Array.from(map.values());
        return nextSkillProgressState;
      });

      let nextSnapshot = createDefaultSkills();
      setSkills((previous) => {
        const fallback = previous ?? createDefaultSkills();
        nextSnapshot = deriveSkillsFromProgress(
          nextSkillProgressState.length > 0 ? nextSkillProgressState : rows,
          fallback,
        );
        return nextSnapshot;
      });

      return nextSnapshot;
    },
    [profile, skills, user],
  );

  const updateXpWallet = useCallback(
    async (updates: XpWalletUpdate) => {
      if (!profile) {
        throw new Error("No active profile selected");
      }

      const payload: any = {
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

  interface AddActivityOptions {
    status?: string | null;
    durationMinutes?: number | null;
    statusId?: string | null;
  }

  interface StartActivityInput {
    status: string;
    durationMinutes?: number | null;
    metadata?: Record<string, unknown> | null;

  }

  const addActivity = useCallback(
    async (
      type: string,
      message: string,
      earnings: number | undefined = undefined,
      metadata: ActivityInsert["metadata"] = null,
      options: AddActivityOptions = {},
    ) => {
      if (!user) {
        throw new Error("Authentication required to log activity");
      }

      if (!profile) {
        throw new Error("No active profile selected");
      }

      const basePayload: Record<string, unknown> = {
        user_id: user.id,
        activity_type: type,
        message,
        earnings: typeof earnings === "number" ? earnings : null,
        metadata: metadata as any,
        status: options.status ?? null,
        status_id: options.statusId ?? null,
      };

      if (activityFeedSupportsDurationRef.current) {
        basePayload.duration_minutes =
          typeof options.durationMinutes === "number" && Number.isFinite(options.durationMinutes)
            ? options.durationMinutes
            : null;
      }

      if (supportsActivityProfileFilter) {
        basePayload.profile_id = profile.id;
      }

      const { error: insertError } = await supabase.from("activity_feed").insert(basePayload as any);

      if (!insertError && basePayload.profile_id) {
        setSupportsActivityProfileFilter(true);
        return;
      }

      if (insertError?.code === "42703" && basePayload.profile_id) {
        console.warn(
          "Activity feed profile_id column missing during insert; retrying without profile reference.",
          insertError,
        );
        setSupportsActivityProfileFilter(false);
        const fallbackPayload: Record<string, unknown> = { ...basePayload };
        delete fallbackPayload.profile_id;
        const { error: fallbackError } = await supabase.from("activity_feed").insert(fallbackPayload as any);
        if (fallbackError) {
          throw fallbackError;
        }
        return;
      }

      if (
        insertError &&
        activityFeedSupportsDurationRef.current &&
        isMissingColumnError(insertError, "duration_minutes")
      ) {
        console.warn(
          "Activity feed duration_minutes column missing during insert; retrying without duration metadata.",
          insertError,
        );

        activityFeedSupportsDurationRef.current = false;

        const fallbackPayload: Record<string, unknown> = { ...basePayload };
        delete fallbackPayload.duration_minutes;

        const { error: fallbackError } = await supabase.from("activity_feed").insert(fallbackPayload as any);
        if (fallbackError) {
          throw fallbackError;
        }
        return;
      }

      if (insertError) {
        throw insertError;
      }
    },
    [profile, supportsActivityProfileFilter, user, activityFeedSupportsDurationRef, isMissingColumnError],
  );

  const refreshActivityStatus = useCallback(async (): Promise<ProfileActivityStatusRow | null> => {
    const profileId = profile?.id;

    if (!profileId) {
      setActivityStatus(null);
      return null;
    }

    if (!activityStatusTableAvailableRef.current) {
      setActivityStatus(null);
      return null;
    }

    const { data, error, status, statusText } = await supabase
      .from("profile_activity_statuses")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (isMissingTableResponse(status, error, "profile_activity_statuses")) {
      const debugInfo = error ?? { status, statusText };
      logActivityStatusTableUnavailable(debugInfo);
      setActivityStatus(null);
      return null;
    }

    if (error) {
      if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "PGRST116") {
        setActivityStatus(null);
        return null;
      }

      console.error("Failed to refresh activity status", error);
      throw error;
    }

    const nextStatus = (data ?? null) as ProfileActivityStatusRow | null;
    activityStatusTableAvailableRef.current = true;
    activityStatusWarningLoggedRef.current = false;
    setActivityStatus(nextStatus);
    return nextStatus;
  }, [profile, isRelationNotFoundError, isSchemaCacheMissingTableError]);

  const clearActivityStatus = useCallback(async (): Promise<void> => {
    if (!profile) {
      throw new Error("No active profile selected");
    }

    if (!activityStatusTableAvailableRef.current) {
      setActivityStatus(null);
      return;
    }

    const result = await supabase
      .from("profile_activity_statuses")
      .delete()
      .eq("profile_id", profile.id);

    if (isMissingTableResponse(result.status ?? null, result.error, "profile_activity_statuses")) {
      const debugInfo =
        result.error ?? { status: result.status ?? null, statusText: result.statusText ?? null };
      logActivityStatusTableUnavailable(debugInfo);
      setActivityStatus(null);
      return;
    }

    if (result.error && typeof result.error === "object" && "code" in result.error && result.error.code !== "PGRST116") {
      throw result.error;
    }

    activityStatusTableAvailableRef.current = true;
    activityStatusWarningLoggedRef.current = false;
    setActivityStatus(null);
  }, [profile]);

  const startActivity = useCallback(
    async ({ status, durationMinutes, metadata }: StartActivityInput): Promise<ProfileActivityStatusRow | null> => {

      if (!profile) {
        throw new Error("No active profile selected");
      }


      if (!activityStatusTableAvailableRef.current) {
        if (!activityStatusWarningLoggedRef.current) {
          console.warn("Profile activity status table is unavailable; skipping activity start");
          activityStatusWarningLoggedRef.current = true;
        }

        return null;
      }

      const normalizedDuration =

        typeof durationMinutes === "number" && Number.isFinite(durationMinutes)
          ? Math.max(0, Math.round(durationMinutes))
          : null;

      const basePayload: Record<string, unknown> = {
        profile_id: profile.id,
        status,
        duration_minutes: normalizedDuration,
        started_at: new Date().toISOString(),
      };

      const includeMetadata =
        metadata && typeof metadata === "object" && activityStatusMetadataSupportedRef.current;

      if (includeMetadata) {
        basePayload.metadata = metadata;
      }

      let result = await supabase
        .from("profile_activity_statuses")
        .upsert(basePayload as any, { onConflict: "profile_id" })
        .select("*")
        .maybeSingle();

      if (
        result.error &&
        includeMetadata &&
        typeof result.error === "object" &&
        result.error &&
        "code" in result.error &&
        (result.error as { code?: string }).code === "42703"
      ) {
        activityStatusMetadataSupportedRef.current = false;
        const retryPayload: any = { ...basePayload };
        delete retryPayload.metadata;
        result = await supabase
          .from("profile_activity_statuses")
          .upsert(retryPayload, { onConflict: "profile_id" })
          .select("*")
          .maybeSingle();
      }

      if (isMissingTableResponse(result.status, result.error, "profile_activity_statuses")) {
        const debugInfo = result.error ?? {
          status: result.status,
          statusText: result.statusText,
        };

        logActivityStatusTableUnavailable(debugInfo);

        setActivityStatus(null);
        return null;
      }

      if (result.error) {
        console.error("Failed to start activity", result.error);
        throw result.error;
      }

      const nextStatus = (result.data ?? null) as ProfileActivityStatusRow | null;
      activityStatusTableAvailableRef.current = true;
      activityStatusWarningLoggedRef.current = false;
      setActivityStatus(nextStatus);
      return nextStatus;
    },
    [profile, isRelationNotFoundError, isSchemaCacheMissingTableError],
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

  const claimDailyXp = useCallback(
    async (metadata: Record<string, unknown> = {}) => {
      if (!profile) {
        throw new Error("No active profile selected");
      }

      const response = await claimDailyXpUtility({ metadata });

      if (response.wallet) {
        setXpWallet(response.wallet as PlayerXpWallet);
      }

      if (response.profile) {
        setProfile((prev) => (prev && prev.id === response.profile.id ? { ...prev, ...response.profile } : prev));
      }

      if (response.attributes) {
        setAttributes(mapAttributes(response.attributes as RawAttributes));
      }

      if (!dailyXpGrantTableAvailableRef.current) {
        setDailyXpGrant(null);
        return;
      }

      const { data: latestGrant, error: latestGrantError } = await supabase
        .from("profile_daily_xp_grants")
        .select("*")
        .eq("profile_id", profile.id)
        .order("grant_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestGrantError) {
        if (isSchemaCacheMissingTableError(latestGrantError)) {
          dailyXpGrantTableAvailableRef.current = false;
          console.warn("Daily XP grant table is unavailable; skipping future queries", latestGrantError);
          setDailyXpGrant(null);
          return;
        }

        if (latestGrantError && typeof latestGrantError === 'object' && latestGrantError && 'code' in latestGrantError && (latestGrantError as any).code !== "PGRST116") {
          console.error("Failed to refresh daily XP grant", latestGrantError);
        }
      }

      setDailyXpGrant((latestGrant ?? null) as DailyXpGrantRow | null);
    },
    [profile],
  );

  const spendAttributeXp = useCallback(
    async ({ attributeKey, amount, metadata, uniqueEventId }: SpendAttributeXpInput) => {
      if (!profile) {
        throw new Error("No active profile selected");
      }

      const response = await spendAttributeXpUtility({ attributeKey, amount, metadata, uniqueEventId });

      if (response.wallet) {
        setXpWallet(response.wallet as PlayerXpWallet);
      }

      if (response.attributes) {
        setAttributes(mapAttributes(response.attributes as RawAttributes));
      }
    },
    [profile],
  );

  const spendSkillXp = useCallback(
    async ({ skillSlug, amount, metadata, uniqueEventId }: SpendSkillXpInput) => {
      if (!profile) {
        throw new Error("No active profile selected");
      }

      const response = await spendSkillXpUtility({ skillSlug, amount, metadata, uniqueEventId });

      if (response.wallet) {
        setXpWallet(response.wallet as PlayerXpWallet);
      }

      let updatedSkillProgress: SkillProgressRow | null = null;

      if (response.result && typeof response.result === "object") {
        const { skill_progress: skillProgressResult } = response.result as {
          skill_progress?: SkillProgressRow | null;
        };
        if (skillProgressResult) {
          updatedSkillProgress = skillProgressResult;
        }
      }

      if (!updatedSkillProgress) {
        const { data: fetchedSkill, error: updatedSkillError } = await supabase
          .from("skill_progress")
          .select("*")
          .eq("profile_id", profile.id)
          .eq("skill_slug", skillSlug)
          .maybeSingle();

        if (updatedSkillError && updatedSkillError.code !== "PGRST116") {
          console.error("Failed to refresh skill progress", updatedSkillError);
        } else if (fetchedSkill) {
          updatedSkillProgress = fetchedSkill as SkillProgressRow;
        }
      }

      if (updatedSkillProgress) {
        setSkillProgress((previous) => {
          const next = Array.isArray(previous) ? [...previous] : [];
          const index = next.findIndex((entry) => entry.skill_slug === skillSlug);
          if (index >= 0) {
            next[index] = updatedSkillProgress as SkillProgressRow;
          } else {
            next.push(updatedSkillProgress as SkillProgressRow);
          }
          return next;
        });
      }
    },
    [profile],
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
      activityStatus,
      dailyXpGrant,
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

      refreshActivityStatus,
      startActivity,
      clearActivityStatus,
      awardActionXp,
      claimDailyXp,
      spendAttributeXp,
      spendSkillXp,
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
      activityStatus,
      dailyXpGrant,
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
      refreshActivityStatus,
      startActivity,
      clearActivityStatus,
      awardActionXp,
      claimDailyXp,
      spendAttributeXp,
      spendSkillXp,
      upsertProfileWithDefaults,
    ],
  );

  return value;
};

interface GameDataProviderProps {
  children: ReactNode;
}

export const GameDataProvider = ({ children }: GameDataProviderProps) => {
  const value = useProvideGameData();

  return <GameDataContext.Provider value={value}>{children}</GameDataContext.Provider>;
};

export const useGameData = (): UseGameDataReturn => {
  const context = useOptionalGameData();

  if (!context) {
    throw new Error("useGameData must be used within a GameDataProvider");
  }

  return context;
};
