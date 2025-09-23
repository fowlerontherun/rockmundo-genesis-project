import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/lib/supabase-types";
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
export type ExperienceLedgerRow = Database["public"]["Tables"]["xp_ledger"]["Row"];
export type UnlockedSkillsMap = Record<string, boolean>;
export type ActivityFeedRow = Database["public"]["Tables"]["activity_feed"]["Row"];
type PlayerHealthMetrics = Database["public"]["Tables"]["player_health_metrics"]["Row"] | null;
type PlayerHealthCondition = Database["public"]["Tables"]["player_health_conditions"]["Row"];
type PlayerHealthHabit = Database["public"]["Tables"]["player_health_habits"]["Row"];
type PlayerWellnessRecommendation = Database["public"]["Tables"]["player_wellness_recommendations"]["Row"];

export interface ProfileUpsertInput {
  name: string;
  stageName: string;
  bio: string;
  attributes?: Partial<PlayerAttributes>;
}

const ATTRIBUTE_COLUMNS: Array<keyof Database["public"]["Tables"]["player_attributes"]["Insert"]> = [
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

const ATTRIBUTE_COLUMN_MAP: Record<AttributeCategory, keyof Database["public"]["Tables"]["player_attributes"]["Row"]> = {
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

const parseNumericValue = (candidate: unknown): number | null => {
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }

  if (typeof candidate === "string") {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const extractDailyXpStipend = (row: DailyXpConfigurationRow): number | null => {
  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = row as Record<string, unknown>;
  const directKeys = [
    "daily_xp_stipend",
    "dailyXpStipend",
    "daily_xp_amount",
    "dailyXpAmount",
    "xp_stipend",
    "xpAmount",
    "amount",
  ];

  for (const key of directKeys) {
    if (key in candidate) {
      const numeric = parseNumericValue(candidate[key]);
      if (numeric !== null) {
        return numeric;
      }
    }
  }

  const keyedSources: Array<[unknown, unknown[]]> = [
    [candidate.config_key, [candidate.config_value, candidate.value, candidate.numeric_value]],
    [candidate.key, [candidate.value, candidate.numeric_value]],
    [candidate.slug, [candidate.numeric_value, candidate.value]],
    [candidate.name, [candidate.numeric_value, candidate.value]],
    [candidate.setting_key, [candidate.setting_value, candidate.value]],
  ];

  for (const [rawKey, rawValues] of keyedSources) {
    if (typeof rawKey === "string" && rawKey.toLowerCase() === "daily_xp_stipend") {
      for (const valueCandidate of rawValues) {
        const numeric = parseNumericValue(valueCandidate);
        if (numeric !== null) {
          return numeric;
        }
      }
    }
  }

  if (candidate.metadata && typeof candidate.metadata === "object") {
    const metadata = candidate.metadata as Record<string, unknown>;
    const metadataKeys = ["daily_xp_stipend", "dailyXpStipend", "daily_xp_amount", "dailyXpAmount"] as const;
    for (const key of metadataKeys) {
      if (key in metadata) {
        const numeric = parseNumericValue(metadata[key]);
        if (numeric !== null) {
          return numeric;
        }
      }
    }
  }

  return null;
};

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

const SCHEMA_CACHE_MISSING_COLUMN_CODES = new Set<string>([
  "PGRST204", // PostgREST column missing (schema cache not refreshed)
  "42703", // Postgres undefined_column SQLSTATE
]);

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
type DailyXpGrantRow = Database["public"]["Tables"]["profile_daily_xp_grants"]["Row"];
type DailyXpSettingsRow = Database["public"]["Tables"]["daily_xp_settings"]["Row"];
type DailyXpConfigurationRow = DailyXpSettingsRow | Record<string, unknown> | null;

type ProfileStatusTable = Database["public"]["Tables"] extends {
  profile_status_sessions: infer Table;
}
  ? Table
  : {
      Row: {
        id: string;
        profile_id: string;
        status: string;
        metadata: Json | null;
        started_at: string | null;
        ends_at: string | null;
        closed_at: string | null;
        created_at: string | null;
        updated_at: string | null;
      };
      Insert: {
        id?: string;
        profile_id: string;
        status: string;
        metadata?: Json | null;
        started_at?: string | null;
        ends_at?: string | null;
        closed_at?: string | null;
      };
      Update: {
        status?: string;
        metadata?: Json | null;
        started_at?: string | null;
        ends_at?: string | null;
        closed_at?: string | null;
      };
    };

type ProfileStatusRow = ProfileStatusTable["Row"];
type ProfileStatusInsert = ProfileStatusTable["Insert"];
type ProfileStatusUpdate = ProfileStatusTable["Update"];

type ProfileWithStatusColumns = PlayerProfile & {
  active_status?: string | null;
  active_status_metadata?: Json | null;
  active_status_started_at?: string | null;
  active_status_ends_at?: string | null;
};

type ActiveStatusSnapshot = {
  status: string | null;
  metadata: Record<string, unknown> | null;
  startedAt: string | null;
  endsAt: string | null;
  sessionId: string | null;
  source: "profile" | "session";
};

type ActiveStatusCountdown = {
  endsAt: string | null;
  remainingMs: number | null;
  remainingSeconds: number | null;
  remainingMinutes: number | null;
  isExpired: boolean;
};

type ActiveStatusState = ActiveStatusCountdown & {
  status: string;
  metadata: Record<string, unknown> | null;
  startedAt: string | null;
  sessionId: string | null;
  source: "profile" | "session";
};

type StartTimedStatusInput = {
  status: string;
  durationMinutes: number;
  metadata?: Json | Record<string, unknown> | null;
  activity?: {
    type: string;
    message: string;
    earnings?: number;
    metadata?: ActivityInsert["metadata"];
  } | null;
};

type ClearActiveStatusOptions = {
  reason?: "manual" | "expired";
  targetProfile?: PlayerProfile | null;
  sessionId?: string | null;
  skipProfileUpdate?: boolean;
};

type UseGameDataReturn = {
  profile: PlayerProfile | null;
  skills: PlayerSkills;
  attributes: PlayerAttributes | null;
  activeStatus: ActiveStatusState | null;
  healthMetrics: PlayerHealthMetrics;
  healthConditions: PlayerHealthCondition[];
  healthHabits: PlayerHealthHabit[];
  wellnessRecommendations: PlayerWellnessRecommendation[];
  xpWallet: PlayerXpWallet;
  xpLedger: ExperienceLedgerRow[];
  skillProgress: SkillProgressRow[];
  unlockedSkills: UnlockedSkillsMap;
  activities: ActivityFeedRow[];
  dailyXpGrant: DailyXpGrantRow | null;
  dailyXpStipend: number | null;
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
    statusExtras?: { status?: string | null; durationMinutes?: number | null },
  ) => Promise<void>;
  getActiveStatusCountdown: () => ActiveStatusCountdown | null;
  startTimedStatus: (input: StartTimedStatusInput) => Promise<ActiveStatusState | null>;
  awardActionXp: (input: AwardActionXpInput) => Promise<void>;
  claimDailyXp: (metadata?: Record<string, unknown>) => Promise<void>;
  spendAttributeXp: (input: SpendAttributeXpInput) => Promise<void>;
  spendSkillXp: (input: SpendSkillXpInput) => Promise<void>;
  upsertProfileWithDefaults: (
    input: ProfileUpsertInput,
  ) => Promise<{ profile: PlayerProfile; attributes: PlayerAttributes | null }>;
};

const GameDataContext = createContext<UseGameDataReturn | undefined>(undefined);

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

const useGameDataInternal = (): UseGameDataReturn => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [skills, setSkills] = useState<PlayerSkills>(null);
  const [attributes, setAttributes] = useState<PlayerAttributes | null>(null);
  const [activeStatus, setActiveStatus] = useState<ActiveStatusState | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<PlayerHealthMetrics>(null);
  const [healthConditions, setHealthConditions] = useState<PlayerHealthCondition[]>([]);
  const [healthHabits, setHealthHabits] = useState<PlayerHealthHabit[]>([]);
  const [wellnessRecommendations, setWellnessRecommendations] = useState<PlayerWellnessRecommendation[]>([]);
  const [xpWallet, setXpWallet] = useState<PlayerXpWallet>(null);
  const [xpLedger, setXpLedger] = useState<ExperienceLedgerRow[]>([]);
  const [skillProgress, setSkillProgress] = useState<SkillProgressRow[]>([]);
  const [unlockedSkills, setUnlockedSkills] = useState<UnlockedSkillsMap>({});
  const [activities, setActivities] = useState<ActivityFeedRow[]>([]);
  const [dailyXpGrant, setDailyXpGrant] = useState<DailyXpGrantRow | null>(null);
  const [dailyXpStipend, setDailyXpStipend] = useState<number | null>(null);
  const [currentCity, setCurrentCity] = useState<CityRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assigningDefaultCityRef = useRef(false);
  const defaultCityAssignmentDisabledRef = useRef(false);
  const dailyXpGrantUnavailableRef = useRef(false);
  const playerSkillsTableMissingRef = useRef(false);
  const activityFeedSupportsProfileIdRef = useRef(true);
  const statusSessionsUnavailableRef = useRef(false);
  const profileStatusColumnsUnavailableRef = useRef(false);
  const activeStatusSnapshotRef = useRef<ActiveStatusSnapshot | null>(null);
  type HealthTableKey = "metrics" | "conditions" | "habits" | "wellness";
  const healthTablesUnavailableRef = useRef<Record<HealthTableKey, boolean>>({
    metrics: false,
    conditions: false,
    habits: false,
    wellness: false,
  });
  const isSchemaCacheMissingColumnError = (error: unknown): error is { code?: string } => {
    if (typeof error !== "object" || error === null || !("code" in error)) {
      return false;
    }

    const code = (error as { code?: string }).code;

    if (typeof code !== "string" || code.length === 0) {
      return false;
    }

    return SCHEMA_CACHE_MISSING_COLUMN_CODES.has(code.toUpperCase());
  };
  const isSchemaCacheMissingTableError = (error: unknown): error is { code?: string } =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "PGRST205";
  const isRelationMissingError = (error: unknown): error is { code?: string } =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ["PGRST116", "PGRST205"].includes((error as { code?: string }).code ?? "");

  const resetHealthTableAvailability = useCallback(() => {
    healthTablesUnavailableRef.current = {
      metrics: false,
      conditions: false,
      habits: false,
      wellness: false,
    };
  }, []);

  const markHealthTableUnavailable = (
    table: HealthTableKey,
    error: { code?: string } | null,
    tableName: string,
  ) => {
    if (error && isRelationMissingError(error)) {
      if (!healthTablesUnavailableRef.current[table]) {
        healthTablesUnavailableRef.current[table] = true;
        console.warn(
          `Skipping ${tableName} load - table missing from schema cache; ensure migrations have run.`,
          error,
        );
      }
      return true;
    }

    return false;
  };

  const profileSupportsStatusColumns = useCallback(
    (candidate: PlayerProfile | null): candidate is ProfileWithStatusColumns => {
      if (!candidate) {
        return false;
      }

      const requiredColumns: Array<keyof ProfileWithStatusColumns> = [
        "active_status",
        "active_status_metadata",
        "active_status_started_at",
        "active_status_ends_at",
      ];

      return requiredColumns.every((column) =>
        Object.prototype.hasOwnProperty.call(candidate, column),
      );
    },
    [],
  );

  const toPlainMetadata = (value: Json | Record<string, unknown> | null | undefined): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  };

  const calculateCountdown = useCallback(
    (endsAt: string | null): ActiveStatusCountdown => {
      if (!endsAt) {
        return {
          endsAt: null,
          remainingMs: null,
          remainingSeconds: null,
        remainingMinutes: null,
        isExpired: false,
      };
    }

    const parsed = new Date(endsAt);
    if (Number.isNaN(parsed.getTime())) {
      return {
        endsAt,
        remainingMs: null,
        remainingSeconds: null,
        remainingMinutes: null,
        isExpired: false,
      };
      }

      const now = Date.now();
      const diff = parsed.getTime() - now;
      const remainingMs = diff <= 0 ? 0 : diff;

      return {
        endsAt,
        remainingMs,
        remainingSeconds: Math.max(0, Math.floor(remainingMs / 1000)),
        remainingMinutes: Math.max(0, Math.ceil(remainingMs / 60000)),
        isExpired: diff <= 0,
      };
    },
    [],
  );

  const deriveActiveStatusState = useCallback(
    (snapshot: ActiveStatusSnapshot | null): ActiveStatusState | null => {
      if (!snapshot) {
        return null;
      }

      const normalizedStatus = typeof snapshot.status === "string" ? snapshot.status.trim() : "";
      if (!normalizedStatus) {
        return null;
      }

      const countdown = calculateCountdown(snapshot.endsAt);
      if (countdown.isExpired) {
        return null;
      }

      return {
        status: normalizedStatus,
        metadata: snapshot.metadata,
        startedAt: snapshot.startedAt,
        sessionId: snapshot.sessionId,
        source: snapshot.source,
        ...countdown,
      };
    },
    [calculateCountdown],
  );

  const mapSessionRowToSnapshot = (row: ProfileStatusRow | null): ActiveStatusSnapshot | null => {
    if (!row) {
      return null;
    }

    const status = typeof row.status === "string" ? row.status : null;
    const startedAt = typeof row.started_at === "string" ? row.started_at : null;
    const endsAt = typeof row.ends_at === "string" ? row.ends_at : null;
    const metadata = toPlainMetadata(row.metadata);
    const sessionId = typeof row.id === "string" ? row.id : null;

    if (!status && !startedAt && !endsAt && !metadata) {
      return null;
    }

    return {
      status,
      metadata,
      startedAt,
      endsAt,
      sessionId,
      source: "session",
    };
  };

  const extractActiveStatusFromProfile = (candidate: PlayerProfile | null): ActiveStatusSnapshot | null => {
    if (!profileSupportsStatusColumns(candidate)) {
      return null;
    }

    const status = typeof candidate.active_status === "string" ? candidate.active_status : null;
    const startedAt =
      typeof candidate.active_status_started_at === "string" ? candidate.active_status_started_at : null;
    const endsAt = typeof candidate.active_status_ends_at === "string" ? candidate.active_status_ends_at : null;
    const metadata = toPlainMetadata(candidate.active_status_metadata);

    if (!status && !startedAt && !endsAt && !metadata) {
      return null;
    }

    return {
      status,
      metadata,
      startedAt,
      endsAt,
      sessionId: null,
      source: "profile",
    };
  };

  const normalizeMetadataInput = (
    value: Json | Record<string, unknown> | null | undefined,
  ): Json | null => {
    if (value === null || typeof value === "undefined") {
      return null;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value as Json;
    }

    if (Array.isArray(value)) {
      return value as Json;
    }

    if (typeof value === "object") {
      try {
        return JSON.parse(JSON.stringify(value)) as Json;
      } catch (serializationError) {
        console.warn("Failed to serialize status metadata; falling back to null.", serializationError, value);
        return null;
      }
    }

    return null;
  };

  const mergeActivityMetadata = (
    base: ActivityInsert["metadata"],
    extras?: { status?: string | null; durationMinutes?: number | null },
  ): ActivityInsert["metadata"] => {
    const hasStatus = typeof extras?.status === "string" && extras.status.trim().length > 0;
    const hasDuration = typeof extras?.durationMinutes === "number" && Number.isFinite(extras.durationMinutes);

    if (!hasStatus && !hasDuration) {
      return base ?? null;
    }

    const normalized: Record<string, unknown> =
      base && typeof base === "object" && !Array.isArray(base) ? { ...(base as Record<string, unknown>) } : {};

    if (hasStatus) {
      normalized.status = extras?.status?.trim();
    }

    if (hasDuration) {
      normalized.duration_minutes = extras?.durationMinutes;
    }

    if (base && typeof base !== "object") {
      normalized.base_value = base;
    } else if (Array.isArray(base)) {
      normalized.base_list = base;
    }

    return normalized as ActivityInsert["metadata"];
  };

  const addActivity = useCallback(
    async (
      type: string,
      message: string,
      earnings: number | undefined = undefined,
      metadata: ActivityInsert["metadata"] = null,
      statusExtras?: { status?: string | null; durationMinutes?: number | null },
    ) => {
      if (!user) {
        throw new Error("Authentication required to log activity");
      }

      if (!profile) {
        throw new Error("No active profile selected");
      }

      const normalizedMetadata = mergeActivityMetadata(metadata, statusExtras);

      const payload: ActivityInsert = {
        user_id: user.id,
        profile_id: profile.id,
        activity_type: type,
        message,
        earnings: typeof earnings === "number" ? earnings : null,
        metadata: normalizedMetadata,
      };

      const { error: insertError } = await supabase.from("activity_feed").insert(payload);
      if (insertError) {
        throw insertError;
      }
    },
    [mergeActivityMetadata, profile, user],
  );

  const closeActiveStatusSession = useCallback(
    async (
      profileId: string,
      {
        sessionId,
        updates,
      }: { sessionId?: string | null; updates?: Partial<ProfileStatusUpdate> } = {},
    ) => {
      if (statusSessionsUnavailableRef.current) {
        return;
      }

      const payload: Partial<ProfileStatusUpdate> = {
        closed_at: new Date().toISOString(),
        ...updates,
      };

      try {
        let query = supabase.from("profile_status_sessions").update(payload);
        if (sessionId) {
          query = query.eq("id", sessionId);
        } else {
          query = query.eq("profile_id", profileId).is("closed_at", null);
        }

        const { error } = await query;

        if (error) {
          if (isSchemaCacheMissingTableError(error)) {
            if (!statusSessionsUnavailableRef.current) {
              statusSessionsUnavailableRef.current = true;
              console.warn(
                "Skipping profile status session updates - profile_status_sessions table missing from schema cache; ensure migrations have run.",
                error,
              );
            }
            return;
          }

          if (error.code !== "PGRST116") {
            console.error("Failed to close active status session", error);
          }
        }
      } catch (sessionError) {
        console.error("Unexpected error closing active status session", sessionError);
      }
    },
    [],
  );

  const clearActiveStatus = useCallback(
    async ({
      reason = "manual",
      targetProfile,
      sessionId,
      skipProfileUpdate = false,
    }: ClearActiveStatusOptions = {}) => {
      const effectiveProfile = targetProfile ?? profile;
      if (!effectiveProfile) {
        activeStatusSnapshotRef.current = null;
        setActiveStatus(null);
        return null;
      }

      const profileId = effectiveProfile.id;
      const currentSnapshot = activeStatusSnapshotRef.current;

      const shouldBackfillEnd =
        reason === "expired" && (!currentSnapshot || !currentSnapshot.endsAt);
      const endTimestamp = new Date().toISOString();

      await closeActiveStatusSession(profileId, {
        sessionId: sessionId ?? currentSnapshot?.sessionId,
        updates: shouldBackfillEnd ? { ends_at: endTimestamp } : undefined,
      });

      const clearedColumns: Partial<ProfileWithStatusColumns> = {
        active_status: null,
        active_status_metadata: null,
        active_status_started_at: null,
        active_status_ends_at: null,
      };

      if (!skipProfileUpdate && !profileStatusColumnsUnavailableRef.current) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .update(clearedColumns)
            .eq("id", profileId)
            .select("*")
            .maybeSingle();

          if (error) {
            if (isSchemaCacheMissingColumnError(error)) {
              if (!profileStatusColumnsUnavailableRef.current) {
                profileStatusColumnsUnavailableRef.current = true;
                console.warn(
                  "Skipping active status profile updates - columns missing from schema cache; ensure migrations have run.",
                  error,
                );
              }
            } else {
              throw error;
            }
          } else if (data) {
            setProfile(data as PlayerProfile);
          }
        } catch (profileError) {
          console.error("Failed to clear active status on profile", profileError);
          throw profileError;
        }
      } else if (!skipProfileUpdate) {
        setProfile((previous) => {
          if (!previous || previous.id !== profileId) {
            return previous;
          }

          return { ...previous, ...clearedColumns } as PlayerProfile;
        });
      }

      activeStatusSnapshotRef.current = null;
      setActiveStatus(null);

      return null;
    },
    [closeActiveStatusSession, profile],
  );

  const getActiveStatusCountdown = useCallback((): ActiveStatusCountdown | null => {
    const snapshot = activeStatusSnapshotRef.current;
    if (!snapshot) {
      return null;
    }

    const countdown = calculateCountdown(snapshot.endsAt);
    return countdown.isExpired ? null : countdown;
  }, [calculateCountdown]);

  const startTimedStatus = useCallback(
    async ({ status, durationMinutes, metadata = null, activity = null }: StartTimedStatusInput) => {
      if (!profile) {
        throw new Error("No active profile selected");
      }

      const normalizedStatus = typeof status === "string" ? status.trim() : "";
      if (!normalizedStatus) {
        throw new Error("Status is required to start a timed session");
      }

      const numericDuration = Number(durationMinutes);
      if (!Number.isFinite(numericDuration) || numericDuration <= 0) {
        throw new Error("A positive durationMinutes value is required to start a timed status");
      }

      await closeActiveStatusSession(profile.id, {
        sessionId: activeStatusSnapshotRef.current?.sessionId,
      });

      const now = new Date();
      const startedAtIso = now.toISOString();
      const endsAtIso = new Date(now.getTime() + numericDuration * 60000).toISOString();
      const metadataPayload = normalizeMetadataInput(metadata);

      let sessionRow: ProfileStatusRow | null = null;

      if (!statusSessionsUnavailableRef.current) {
        try {
          const insertPayload: ProfileStatusInsert = {
            profile_id: profile.id,
            status: normalizedStatus,
            metadata: metadataPayload,
            started_at: startedAtIso,
            ends_at: endsAtIso,
          };

          const { data, error } = await supabase
            .from("profile_status_sessions")
            .insert(insertPayload)
            .select("*")
            .single();

          if (error) {
            if (isSchemaCacheMissingTableError(error)) {
              if (!statusSessionsUnavailableRef.current) {
                statusSessionsUnavailableRef.current = true;
                console.warn(
                  "Skipping profile status session logging - profile_status_sessions table missing from schema cache; ensure migrations have run.",
                  error,
                );
              }
            } else {
              throw error;
            }
          } else if (data) {
            sessionRow = data as ProfileStatusRow;
          }
        } catch (sessionError) {
          console.error("Failed to create profile status session", sessionError);
          throw sessionError;
        }
      }

      let updatedProfile: PlayerProfile | null = null;

      if (!profileStatusColumnsUnavailableRef.current) {
        try {
          const updatePayload: Partial<ProfileWithStatusColumns> = {
            active_status: normalizedStatus,
            active_status_metadata: metadataPayload,
            active_status_started_at: startedAtIso,
            active_status_ends_at: endsAtIso,
          };

          const { data, error } = await supabase
            .from("profiles")
            .update(updatePayload)
            .eq("id", profile.id)
            .select("*")
            .single();

          if (error) {
            if (isSchemaCacheMissingColumnError(error)) {
              if (!profileStatusColumnsUnavailableRef.current) {
                profileStatusColumnsUnavailableRef.current = true;
                console.warn(
                  "Skipping active status profile updates - columns missing from schema cache; ensure migrations have run.",
                  error,
                );
              }
            } else {
              throw error;
            }
          } else if (data) {
            updatedProfile = data as PlayerProfile;
            setProfile(updatedProfile);
          }
        } catch (profileError) {
          console.error("Failed to update profile with active status", profileError);
          throw profileError;
        }
      }

      if (!updatedProfile) {
        const fallbackUpdates: Partial<ProfileWithStatusColumns> = {
          active_status: normalizedStatus,
          active_status_metadata: metadataPayload,
          active_status_started_at: startedAtIso,
          active_status_ends_at: endsAtIso,
        };

        setProfile((previous) => {
          if (!previous || previous.id !== profile.id) {
            return previous;
          }

          return { ...previous, ...fallbackUpdates } as PlayerProfile;
        });
      }

      const snapshot: ActiveStatusSnapshot | null = sessionRow
        ? mapSessionRowToSnapshot(sessionRow)
        : {
            status: normalizedStatus,
            metadata: toPlainMetadata(metadataPayload),
            startedAt: startedAtIso,
            endsAt: endsAtIso,
            sessionId: sessionRow?.id ?? null,
            source: sessionRow ? "session" : "profile",
          };

      if (!snapshot) {
        activeStatusSnapshotRef.current = null;
        setActiveStatus(null);
        return null;
      }

      activeStatusSnapshotRef.current = snapshot;
      const state = deriveActiveStatusState(snapshot);
      setActiveStatus(state);

      if (activity) {
        await addActivity(
          activity.type,
          activity.message,
          activity.earnings,
          activity.metadata ?? null,
          { status: normalizedStatus, durationMinutes: numericDuration },
        );
      }

      return state;
    },
    [
      addActivity,
      closeActiveStatusSession,
      deriveActiveStatusState,
      isSchemaCacheMissingColumnError,
      isSchemaCacheMissingTableError,
      mapSessionRowToSnapshot,
      normalizeMetadataInput,
      profile,
      toPlainMetadata,
    ],
  );

  const loadProfileDetails = useCallback(
    async (activeProfile: PlayerProfile | null) => {
      if (!user || !activeProfile) {
        setSkills(null);
        setAttributes(null);
        activeStatusSnapshotRef.current = null;
        setActiveStatus(null);
        setHealthMetrics(null);
        setHealthConditions([]);
        setHealthHabits([]);
        setWellnessRecommendations([]);
        setXpWallet(null);
        setXpLedger([]);
        setSkillProgress([]);
        setUnlockedSkills({});
        setActivities([]);
        setCurrentCity(null);
        setDailyXpGrant(null);
        playerSkillsTableMissingRef.current = false;
        resetHealthTableAvailability();
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

      const skillsPromise = playerSkillsTableMissingRef.current
        ? Promise.resolve({ data: null, error: null })
        : supabase
            .from("player_skills")
            .select("*")
            .eq("profile_id", effectiveProfile.id)
            .eq("user_id", user.id)
            .maybeSingle();

      const dailyGrantPromise = dailyXpGrantUnavailableRef.current
        ? Promise.resolve({ data: null, error: null })
        : supabase
            .from("profile_daily_xp_grants")
            .select("*")
            .eq("profile_id", effectiveProfile.id)
            .order("grant_date", { ascending: false })
            .limit(1)

            .maybeSingle();

      const healthMetricsPromise = healthTablesUnavailableRef.current.metrics
        ? Promise.resolve({ data: null, error: null })
        : supabase
            .from("player_health_metrics")
            .select("*")
            .eq("profile_id", effectiveProfile.id)
            .eq("user_id", user.id)
            .maybeSingle();

      const healthConditionsPromise = healthTablesUnavailableRef.current.conditions
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("player_health_conditions")
            .select("*")
            .eq("profile_id", effectiveProfile.id)
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("detected_at", { ascending: false });

      const healthHabitsPromise = healthTablesUnavailableRef.current.habits
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("player_health_habits")
            .select("*")
            .eq("profile_id", effectiveProfile.id)
            .eq("user_id", user.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false });

      const wellnessRecommendationsPromise = healthTablesUnavailableRef.current.wellness
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("player_wellness_recommendations")
            .select("*")
            .eq("profile_id", effectiveProfile.id)
            .eq("user_id", user.id)
            .eq("is_completed", false)
            .order("created_at", { ascending: true });

      const buildActivityFeedQuery = (includeProfileFilter: boolean) => {
        let query = supabase
          .from("activity_feed")
          .select("*")
          .eq("user_id", user.id);

        if (includeProfileFilter) {
          query = query.eq("profile_id", effectiveProfile.id);
        }

        return query.order("created_at", { ascending: false }).limit(20);
      };

      const activitiesPromise = (async () => {
        let result = await buildActivityFeedQuery(activityFeedSupportsProfileIdRef.current);

        if (
          result.error &&
          activityFeedSupportsProfileIdRef.current &&
          isSchemaCacheMissingColumnError(result.error)
        ) {
          activityFeedSupportsProfileIdRef.current = false;
          console.warn(
            "Skipping profile_id filter for activity feed - column missing from schema cache; ensure migrations have run.",
            result.error,
          );

          result = await buildActivityFeedQuery(false);
        }

        return result;
      })();

      const statusSessionPromise = statusSessionsUnavailableRef.current
        ? Promise.resolve({ data: null, error: null })
        : supabase
            .from("profile_status_sessions")
            .select("*")
            .eq("profile_id", effectiveProfile.id)
            .is("closed_at", null)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

      const [
        skillsResult,
        attributesResult,
        walletResult,
        ledgerResult,
        cityResult,
        activitiesResult,
        skillProgressResult,
        dailyGrantResult,
        healthMetricsResult,
        healthConditionsResult,
        healthHabitsResult,
        wellnessRecommendationsResult,
        statusSessionResult,
      ] = await Promise.all([
        skillsPromise,
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
          .from("xp_ledger")
          .select("*")
          .eq("profile_id", effectiveProfile.id)
          .order("created_at", { ascending: false })
          .limit(XP_LEDGER_FETCH_LIMIT),
        effectiveProfile.current_city_id
          ? supabase.from("cities").select("*").eq("id", effectiveProfile.current_city_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        activitiesPromise,
        supabase
          .from("skill_progress")
          .select("*")
          .eq("profile_id", effectiveProfile.id)
          .order("current_level", { ascending: false, nullsFirst: false })
          .order("current_xp", { ascending: false, nullsFirst: false }),
        dailyGrantPromise,
        healthMetricsPromise,
        healthConditionsPromise,
        healthHabitsPromise,
        wellnessRecommendationsPromise,
        statusSessionPromise,
      ]);

      const metricsUnavailable = markHealthTableUnavailable(
        "metrics",
        healthMetricsResult?.error ?? null,
        "player_health_metrics",
      );
      const conditionsUnavailable = markHealthTableUnavailable(
        "conditions",
        healthConditionsResult?.error ?? null,
        "player_health_conditions",
      );
      const habitsUnavailable = markHealthTableUnavailable(
        "habits",
        healthHabitsResult?.error ?? null,
        "player_health_habits",
      );
      const wellnessUnavailable = markHealthTableUnavailable(
        "wellness",
        wellnessRecommendationsResult?.error ?? null,
        "player_wellness_recommendations",
      );

      if (skillsResult.error) {
        if (isSchemaCacheMissingTableError(skillsResult.error, "player_skills")) {
          if (!playerSkillsTableMissingRef.current) {
            console.warn(
              "Player skills table missing from schema cache. Disabling legacy skills features until the schema is refreshed.",
              skillsResult.error,
            );
          }
          playerSkillsTableMissingRef.current = true;
        } else {
          console.error("Failed to load player skills", skillsResult.error);
        }
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
      if (skillProgressResult.error) {
        console.error("Failed to load skill progress", skillProgressResult.error);
      }
      if (!metricsUnavailable && healthMetricsResult.error) {
        console.error("Failed to load health metrics", healthMetricsResult.error);
      }
      if (!conditionsUnavailable && healthConditionsResult.error) {
        console.error("Failed to load health conditions", healthConditionsResult.error);
      }
      if (!habitsUnavailable && healthHabitsResult.error) {
        console.error("Failed to load health habits", healthHabitsResult.error);
      }
      if (!wellnessUnavailable && wellnessRecommendationsResult.error) {
        console.error("Failed to load wellness recommendations", wellnessRecommendationsResult.error);
      }
      if (statusSessionResult?.error) {
        if (isSchemaCacheMissingTableError(statusSessionResult.error)) {
          if (!statusSessionsUnavailableRef.current) {
            statusSessionsUnavailableRef.current = true;
            console.warn(
              "Skipping profile status session load - profile_status_sessions table missing from schema cache; ensure migrations have run.",
              statusSessionResult.error,
            );
          }
        } else if (statusSessionResult.error.code !== "PGRST116") {
          console.error("Failed to load active profile status session", statusSessionResult.error);
        }
      }

      const hasStatusColumns = profileSupportsStatusColumns(effectiveProfile);
      if (!hasStatusColumns) {
        if (!profileStatusColumnsUnavailableRef.current) {
          profileStatusColumnsUnavailableRef.current = true;
          console.warn(
            "Skipping active status hydration - profile columns missing from schema cache; ensure migrations have run.",
            { profileId: effectiveProfile.id },
          );
        }
      } else if (profileStatusColumnsUnavailableRef.current) {
        profileStatusColumnsUnavailableRef.current = false;
      }

      let shouldIgnoreDailyGrantError = false;

      if (dailyGrantResult.error) {
        if (isSchemaCacheMissingTableError(dailyGrantResult.error)) {
          if (!dailyXpGrantUnavailableRef.current) {
            dailyXpGrantUnavailableRef.current = true;
            console.warn(
              "Skipping daily XP grant load - profile_daily_xp_grants table missing from schema cache; ensure migrations have run.",
              dailyGrantResult.error,
            );
          }
          shouldIgnoreDailyGrantError = true;
        } else if (dailyGrantResult.error.code !== "PGRST116") {
          console.error("Failed to load daily XP grant", dailyGrantResult.error);
        }

      }
      if (dailyGrantResult.error && shouldIgnoreDailyGrantError) {
        console.info("Daily XP grant data is unavailable on this schema version; skipping.");
      }

      let resolvedStatusSnapshot: ActiveStatusSnapshot | null = null;

      if (!statusSessionResult?.error && statusSessionResult?.data) {
        resolvedStatusSnapshot = mapSessionRowToSnapshot(statusSessionResult.data as ProfileStatusRow);
      }

      if (!resolvedStatusSnapshot && hasStatusColumns) {
        resolvedStatusSnapshot = extractActiveStatusFromProfile(effectiveProfile);
      }

      if (resolvedStatusSnapshot) {
        const countdown = calculateCountdown(resolvedStatusSnapshot.endsAt);
        if (countdown.isExpired) {
          try {
            await clearActiveStatus({
              reason: "expired",
              targetProfile: effectiveProfile,
              sessionId: resolvedStatusSnapshot.sessionId,
            });
          } catch (statusClearError) {
            console.error("Failed to clear expired active status", statusClearError);
          }
          resolvedStatusSnapshot = null;
        }
      }

      activeStatusSnapshotRef.current = resolvedStatusSnapshot;
      setActiveStatus(deriveActiveStatusState(resolvedStatusSnapshot));

      setSkills((skillsResult.data ?? null) as PlayerSkills);
      setAttributes(mapAttributes((attributesResult.data ?? null) as RawAttributes));
      setXpWallet((walletResult.data ?? null) as PlayerXpWallet);
      setXpLedger((ledgerResult.data ?? []) as ExperienceLedgerRow[]);
      setCurrentCity((cityResult?.data ?? null) as CityRow | null);
      setActivities((activitiesResult.data ?? []) as ActivityFeedRow[]);
      setSkillProgress((skillProgressResult.data ?? []) as SkillProgressRow[]);
      setUnlockedSkills({});
      const metricsRow = metricsUnavailable
        ? null
        : ((healthMetricsResult?.data ?? null) as PlayerHealthMetrics);
      setHealthMetrics(metricsRow);
      setHealthConditions(
        (conditionsUnavailable || healthConditionsResult?.error
          ? []
          : (healthConditionsResult?.data ?? [])) as PlayerHealthCondition[],
      );
      setHealthHabits(
        (habitsUnavailable || healthHabitsResult?.error ? [] : (healthHabitsResult?.data ?? [])) as PlayerHealthHabit[],
      );
      setWellnessRecommendations(
        (wellnessUnavailable || wellnessRecommendationsResult?.error
          ? []
          : (wellnessRecommendationsResult?.data ?? [])) as PlayerWellnessRecommendation[],
      );
      const grantRow =
        dailyGrantResult.error || !dailyGrantResult.data
          ? null
          : ((dailyGrantResult.data ?? null) as DailyXpGrantRow | null);
      setDailyXpGrant(grantRow);

      let stipendResolved = false;
      let resolvedStipend: number | null = null;
      let stipendErrored = false;

      try {
        const {
          data: dailySettings,
          error: dailySettingsError,
        } = await supabase
          .from("daily_xp_settings")
          .select("*")
          .eq("id", true)
          .limit(1)
          .maybeSingle();

        if (dailySettingsError) {
          if (isSchemaCacheMissingTableError(dailySettingsError)) {
            console.info(
              "Daily XP settings table missing from schema cache; falling back to legacy configuration table if available.",
              dailySettingsError,
            );
          } else if (dailySettingsError.code !== "PGRST116") {
            stipendErrored = true;
            console.error("Failed to load daily XP settings", dailySettingsError);
          }
        } else if (dailySettings) {
          stipendResolved = true;
          resolvedStipend = extractDailyXpStipend((dailySettings ?? null) as DailyXpConfigurationRow);
        } else {
          stipendResolved = true;
        }

        if (!stipendResolved || resolvedStipend === null) {
          const configClient = supabase as unknown as { from: (table: string) => any };
          const stipendAttempt = await configClient
            .from("game_configuration")
            .select("*")
            .eq("config_key", "daily_xp_stipend")
            .limit(1)
            .maybeSingle();

          if (stipendAttempt?.error) {
            if (isSchemaCacheMissingTableError(stipendAttempt.error)) {
              console.info(
                "Legacy game configuration table missing from schema cache; daily XP stipend may not be configured on this environment.",
                stipendAttempt.error,
              );
            } else {
              stipendErrored = true;
              console.error("Failed to load daily XP configuration", stipendAttempt.error);
            }
          } else {
            stipendResolved = true;
            resolvedStipend = extractDailyXpStipend((stipendAttempt?.data ?? null) as DailyXpConfigurationRow);
          }

          if (!stipendResolved || resolvedStipend === null) {
            const stipendFallback = await configClient
              .from("game_configuration")
              .select("*")
              .limit(20);

            if (stipendFallback?.error) {
              if (isSchemaCacheMissingTableError(stipendFallback.error)) {
                console.info(
                  "Legacy game configuration table missing from schema cache; daily XP stipend may not be configured on this environment.",
                  stipendFallback.error,
                );
              } else if (!stipendAttempt?.error) {
                stipendErrored = true;
                console.error("Failed to load daily XP configuration", stipendFallback.error);
              }
            } else if (Array.isArray(stipendFallback?.data)) {
              stipendResolved = true;
              for (const entry of stipendFallback.data as DailyXpConfigurationRow[]) {
                const extracted = extractDailyXpStipend(entry);
                if (extracted !== null) {
                  resolvedStipend = extracted;
                  break;
                }
              }
            } else if (stipendFallback?.data) {
              stipendResolved = true;
              resolvedStipend = extractDailyXpStipend(stipendFallback.data as DailyXpConfigurationRow);
            }
          }
        }
      } catch (configurationError) {
        stipendErrored = true;
        console.error("Unexpected error loading daily XP configuration", configurationError);
      }

      if (resolvedStipend !== null) {
        setDailyXpStipend(resolvedStipend);
      } else if (stipendResolved || stipendErrored) {
        setDailyXpStipend(null);
      }
    },
    [
      calculateCountdown,
      clearActiveStatus,
      deriveActiveStatusState,
      extractActiveStatusFromProfile,
      mapSessionRowToSnapshot,
      profileSupportsStatusColumns,
      resetHealthTableAvailability,
      user,
    ],
  );

  const fetchData = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setSkills(null);
      setAttributes(null);
      activeStatusSnapshotRef.current = null;
      setActiveStatus(null);
      setHealthMetrics(null);
      setHealthConditions([]);
      setHealthHabits([]);
      setWellnessRecommendations([]);
      setXpWallet(null);
      setXpLedger([]);
      setSkillProgress([]);
      setUnlockedSkills({});
      setActivities([]);
      setCurrentCity(null);
      setDailyXpGrant(null);
      setDailyXpStipend(null);
      resetHealthTableAvailability();
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

      if (playerSkillsTableMissingRef.current) {
        console.warn(
          "Skipping player skill update - player_skills table unavailable in schema cache.",
          updates,
        );
        return null;
      }

      const payload: Database["public"]["Tables"]["player_skills"]["Insert"] = {
        profile_id: profile.id,
        user_id: user.id,
        ...updates,
      };

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

      if (dailyXpGrantUnavailableRef.current) {
        setDailyXpGrant(null);
      } else {
        const { data: latestGrant, error: latestGrantError } = await supabase
          .from("profile_daily_xp_grants")
          .select("*")
          .eq("profile_id", profile.id)
          .order("grant_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestGrantError) {
          if (isSchemaCacheMissingTableError(latestGrantError)) {
            if (!dailyXpGrantUnavailableRef.current) {
              dailyXpGrantUnavailableRef.current = true;
              console.warn(
                "Skipping daily XP grant refresh - profile_daily_xp_grants table missing from schema cache; ensure migrations have run.",
                latestGrantError,
              );
            }
            setDailyXpGrant(null);
          } else if (latestGrantError.code !== "PGRST116") {
            console.error("Failed to refresh daily XP grant", latestGrantError);
            setDailyXpGrant(null);
          } else {
            setDailyXpGrant(null);
          }
        } else {
          setDailyXpGrant((latestGrant ?? null) as DailyXpGrantRow | null);
        }
      }
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

      const { data: updatedSkill, error: updatedSkillError } = await supabase
        .from("skill_progress")
        .select("*")
        .eq("profile_id", profile.id)
        .eq("skill_slug", skillSlug)
        .maybeSingle();

      if (updatedSkillError && updatedSkillError.code !== "PGRST116") {
        console.error("Failed to refresh skill progress", updatedSkillError);
      } else if (updatedSkill) {
        setSkillProgress((previous) => {
          const next = Array.isArray(previous) ? [...previous] : [];
          const index = next.findIndex((entry) => entry.skill_slug === skillSlug);
          if (index >= 0) {
            next[index] = updatedSkill as SkillProgressRow;
          } else {
            next.push(updatedSkill as SkillProgressRow);
          }
          return next;
        });
      }

      if (response.result && typeof response.result === "object") {
        const result = response.result as Record<string, unknown>;
        if (typeof result.current_level === "number" || typeof result.current_xp === "number") {
          setSkillProgress((previous) => {
            const next = Array.isArray(previous) ? [...previous] : [];
            const index = next.findIndex((entry) => entry.skill_slug === skillSlug);
            if (index >= 0) {
              next[index] = {
                ...next[index],
                current_level:
                  typeof result.current_level === "number" ? result.current_level : next[index].current_level,
                current_xp:
                  typeof result.current_xp === "number" ? result.current_xp : next[index].current_xp,
                required_xp:
                  typeof result.required_xp === "number" ? result.required_xp : next[index].required_xp,
                updated_at: new Date().toISOString(),
                last_practiced_at: new Date().toISOString(),
              };
            }
            return next;
          });
        }
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
      activeStatus,
      healthMetrics,
      healthConditions,
      healthHabits,
      wellnessRecommendations,
      xpWallet,
      xpLedger,
      skillProgress,
      unlockedSkills,
      activities,
      dailyXpGrant,
      dailyXpStipend,
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
      getActiveStatusCountdown,
      startTimedStatus,
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
      activeStatus,
      healthMetrics,
      healthConditions,
      healthHabits,
      wellnessRecommendations,
      xpWallet,
      xpLedger,
      skillProgress,
      unlockedSkills,
      activities,
      dailyXpGrant,
      dailyXpStipend,
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
      getActiveStatusCountdown,
      startTimedStatus,
      awardActionXp,
      claimDailyXp,
      spendAttributeXp,
      spendSkillXp,
      upsertProfileWithDefaults,
    ],
  );

  return value;
};

export const GameDataProvider = ({ children }: { children: ReactNode }) => {
  const value = useGameDataInternal();
  return <GameDataContext.Provider value={value}>{children}</GameDataContext.Provider>;
};

export const useGameData = (): UseGameDataReturn => {
  const context = useContext(GameDataContext);
  if (!context) {
    throw new Error("useGameData must be used within a GameDataProvider");
  }

  return context;
};
