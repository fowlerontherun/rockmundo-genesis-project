import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  progressionClient,
  type AwardActionXpInput,
  type BuyAttributeStarInput,
  type ProgressionResponse
} from "@/integrations/supabase/progressionClient";
import { useAuth } from "@/hooks/use-auth-context";
import type { Tables } from "@/integrations/supabase/types";
import type { ProgressionActionSuccessResponse } from "@/types/progression";

import { sortByOptionalKeys } from "@/utils/sorting";
import {
  ATTRIBUTE_KEYS,
  clampAttributeValue,
  type AttributeKey,
} from "@/utils/attributeProgression";
import {
  type PlayerXpWalletSnapshot as PlayerXpWalletSnapshotData,
  type ProgressionCooldowns,
  type ProgressionFunctionResult,
  type ProgressionStateSnapshot
} from "@/utils/progressionClient";
import type {
  PostgrestError,
  PostgrestMaybeSingleResponse,
  PostgrestResponse
} from "@supabase/supabase-js";

export type PlayerProfile = Tables<"profiles">;
export type PlayerSkills = Tables<"player_skills">;
export type PlayerAttributes = Tables<"player_attributes">;
export type PlayerXpWallet = Tables<"player_xp_wallet">;
export type ActivityItem = Tables<"activity_feed">;
export type XpLedgerEntry = Tables<"xp_ledger">;

export type PlayerXpWalletSnapshotType = PlayerXpWalletSnapshotData;
// Temporary type definitions until database schema is updated
type AttributeDefinition = any;
type ProfileAttribute = any;

// Temporary type definitions until proper types are available
export type SkillDefinition = any;
export type SkillProgressRow = any;
export type SkillUnlockRow = any;
export type UnlockedSkillsMap = Record<string, boolean>;
type SkillProgressUpsertInput = any;
type SkillUnlockUpsertInput = any;

type Nullable<T> = T | null;

const CHARACTER_STORAGE_KEY = "rockmundo:selectedCharacterId";
const WEEKLY_BONUS_ACK_STORAGE_PREFIX = "rockmundo:weeklyBonusAck:";
export const WEEKLY_BONUS_REASON = "weekly_bonus" as const;

export interface WeeklyBonusEvaluationResult {
  freshWeeklyBonusAvailable: boolean;
  acknowledgementToPersist?: string | null;
}

export const resolveWeeklyBonusAcknowledgementTimestamp = (
  latestEntry: XpLedgerEntry | undefined,
  now: Date = new Date()
) => {
  const recordedAt = toValidDate(latestEntry?.created_at ?? null);
  return (recordedAt ?? now).toISOString();
};

export const evaluateWeeklyBonusState = (
  latestEntry: XpLedgerEntry | undefined,
  storedAcknowledgement: string | null,
  now: Date = new Date()
): WeeklyBonusEvaluationResult => {
  if (!latestEntry) {
    return {
      freshWeeklyBonusAvailable: false,
      acknowledgementToPersist: storedAcknowledgement ? undefined : null
    };
  }

  const recordedAt = toValidDate(latestEntry.created_at);
  const acknowledgedAt = storedAcknowledgement ? toValidDate(storedAcknowledgement) : null;

  if (recordedAt && (!acknowledgedAt || recordedAt > acknowledgedAt)) {
    return { freshWeeklyBonusAvailable: true };
  }

  if (!recordedAt && !storedAcknowledgement) {
    return {
      freshWeeklyBonusAvailable: false,
      acknowledgementToPersist: now.toISOString()
    };
  }

  return { freshWeeklyBonusAvailable: false };
};

const toValidDate = (value: unknown) => {
  if (typeof value === "string" || value instanceof Date) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
};

const toSafeNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const resolveSkillKey = (row: Record<string, unknown> | null | undefined) => {
  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = (row["skill_id"] ?? row["skillId"]) as unknown;

  if (typeof candidate === "string" || typeof candidate === "number") {
    return String(candidate);
  }

  return null;
};

const mergeRowsBySkillId = <T extends Record<string, unknown>>(
  existingRows: T[] | null | undefined,
  updatedRows: T[] | null | undefined
) => {
  const base: T[] = Array.isArray(existingRows) ? [...existingRows] : [];

  const indexByKey = new Map<string, number>();

  base.forEach((row, index) => {
    const key = resolveSkillKey(row);
    if (key) {
      indexByKey.set(key, index);
    }
  });

  if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
    return base;
  }

  updatedRows.forEach(row => {
    if (!row || typeof row !== "object") {
      return;
    }

    const key = resolveSkillKey(row);
    if (!key) {
      base.push(row);
      return;
    }

    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      indexByKey.set(key, base.length);
      base.push(row);
      return;
    }

    const existingRow = base[existingIndex];
    base[existingIndex] = {
      ...(typeof existingRow === "object" && existingRow ? existingRow : {}),
      ...row
    } as T;
  });

  return base;
};

const isMissingColumnError = (
  error: PostgrestError | null | undefined,
  column: string
) => {
  if (!error || !column) {
    return false;
  }

  if (error.code !== "42703" && error.code !== "PGRST204") {
    return false;
  }

  const haystacks = [error.message, error.details, error.hint].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  if (haystacks.length === 0) {
    return false;
  }

  const target = column.toLowerCase();
  return haystacks.some(haystack => haystack.toLowerCase().includes(target));
};

const extractMissingColumn = (error: PostgrestError | null | undefined) => {
  if (!error) {
    return null;
  }

  const haystacks = [error.message, error.details, error.hint].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  const patterns = [
    /column\s+(?:"?[\w]+"?\.)?"?([\w]+)"?\s+does not exist/i,
    /could not find the '([\w]+)' column/i,
    /'([\w]+)'\s+column/i
  ];

  for (const haystack of haystacks) {
    for (const pattern of patterns) {
      const match = haystack.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
  }

  return null;
};

const isMissingTableError = (error: PostgrestError | null | undefined) => {
  if (!error) {
    return false;
  }

  if (error.code === "42P01" || error.code === "PGRST201") {
    return true;
  }

  const haystacks = [error.message, error.details, error.hint].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  if (haystacks.length === 0) {
    return false;
  }

  const patterns = [
    /does not exist/i,
    /could not find the table/i,
    /schema cache/i
  ];

  // PostgREST sometimes bubbles missing-table errors through the schema cache.
  return haystacks.some(haystack => patterns.some(pattern => pattern.test(haystack)));
};

const omitFromRecord = <T extends Record<string, unknown>>(source: T, key: string) => {
  if (!(key in source)) {
    return source;
  }

  const { [key]: _omitted, ...rest } = source;
  return rest as T;
};

const extractLedgerEntriesFromResult = (result: unknown): ExperienceLedgerEntry[] => {
  if (!result || typeof result !== "object") {
    return [];
  }

  const source = result as Record<string, unknown>;
  const entries: ExperienceLedgerEntry[] = [];
  const seen = new Set<string>();

  const candidateObjects = [
    source.ledger_entry,
    source.xp_ledger_entry,
    source.ledgerEntry,
    source.ledger,
  ];

  for (const candidate of candidateObjects) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const entry = candidate as ExperienceLedgerEntry;
      if (entry.id && !seen.has(entry.id)) {
        entries.push(entry);
        seen.add(entry.id);
      }
    }
  }

  const candidateLists = [
    source.ledger_entries,
    source.xp_ledger_entries,
    source.ledger,
  ];

  for (const list of candidateLists) {
    if (Array.isArray(list)) {
      for (const item of list) {
        if (item && typeof item === "object") {
          const entry = item as ExperienceLedgerEntry;
          if (entry.id && !seen.has(entry.id)) {
            entries.push(entry);
            seen.add(entry.id);
          }
        }
      }
    }
  }

  return entries;
};

export interface CreateCharacterInput {
  username: string;
  displayName?: string;
  slotNumber: number;
  unlockCost: number;
  makeActive?: boolean;
}

interface GameDataContextValue {
  characters: PlayerProfile[];
  selectedCharacterId: string | null;
  profile: PlayerProfile | null;
  xpWallet: PlayerXpWallet | null;
  attributeStarTotal: number;
  freshWeeklyBonusAvailable: boolean;
  skillDefinitions: SkillDefinition[];
  skillProgress: SkillProgressRow[];
  unlockedSkills: UnlockedSkillsMap;
  skills: PlayerSkills | null;
  attributes: PlayerAttributes | null;
  activities: ActivityItem[];
  xpLedger: XpLedgerEntry[];
  progressionCooldowns: ProgressionCooldowns;
  currentCity: Tables<"cities"> | null;
  loading: boolean;
  error: string | null;
  hasCharacters: boolean;
  skillUnlocks: SkillUnlockRow[];
  setActiveCharacter: (characterId: string) => Promise<void>;
  clearSelectedCharacter: () => void;
  updateProfile: (updates: Partial<PlayerProfile>) => Promise<PlayerProfile | undefined>;
  updateSkills: (updates: Partial<PlayerSkills>) => Promise<PlayerSkills | undefined>;
  updateAttributes: (updates: Partial<PlayerAttributes>) => Promise<PlayerAttributes | undefined>;
  addActivity: (
    activityType: string,
    message: string,
    earnings?: number,
    metadata?: ActivityItem["metadata"]
  ) => Promise<ActivityItem>;
  applyProgressionUpdate: (response: ProgressionActionSuccessResponse) => void;
  refreshProgressionState: (
    options?: RefreshProgressionOptions
  ) => Promise<void>;
  acknowledgeWeeklyBonus: () => void;
  createCharacter: (input: CreateCharacterInput) => Promise<PlayerProfile>;
  refreshCharacters: () => Promise<PlayerProfile[]>;
  refetch: () => Promise<void>;
  resetCharacter: () => Promise<void>;
  upsertSkillProgress: (
    profileId: string,
    entries: SkillProgressUpsertInput[]
  ) => Promise<SkillProgressRow[]>;
  upsertSkillUnlocks: (
    profileId: string,
    entries: SkillUnlockUpsertInput[]
  ) => Promise<SkillUnlockRow[]>;
}

const GameDataContext = createContext<GameDataContextValue | undefined>(undefined);

const missingProviderMessage = "useGameData must be used within a GameDataProvider";

const warnMissingProvider = () => {
  if (typeof console !== "undefined") {
    console.warn(missingProviderMessage);
  }
};

const DEFAULT_PROGRESSION_COOLDOWNS = {} as ProgressionCooldowns;
const PROGRESSION_COOLDOWN_KEYS = [] as (keyof ProgressionCooldowns)[];

const createDefaultCooldownState = (): ProgressionCooldowns => ({
  ...DEFAULT_PROGRESSION_COOLDOWNS
});

const defaultGameDataContext: GameDataContextValue = {
  characters: [],
  selectedCharacterId: null,
  profile: null,
  xpWallet: null,
  attributeStarTotal: 0,
  freshWeeklyBonusAvailable: false,
  skillDefinitions: [],
  skillProgress: [],
  unlockedSkills: {},
  skills: null,
  attributes: null,
  activities: [],
  xpLedger: [],
  progressionCooldowns: createDefaultCooldownState(),
  currentCity: null,
  loading: false,
  error: missingProviderMessage,
  hasCharacters: false,
  skillUnlocks: [],
  setActiveCharacter: async () => {
    warnMissingProvider();
  },
  clearSelectedCharacter: () => {
    warnMissingProvider();
  },
  updateProfile: async () => {
    warnMissingProvider();
    return undefined;
  },
  updateSkills: async () => {
    warnMissingProvider();
    return undefined;
  },
  updateAttributes: async () => {
    warnMissingProvider();
    return undefined;
  },
  addActivity: async () => {
    warnMissingProvider();
    return Promise.reject(new Error(missingProviderMessage)) as Promise<ActivityItem>;
  },
  applyProgressionUpdate: () => {
    warnMissingProvider();
  },
  refreshProgressionState: async () => {
    warnMissingProvider();
  },
  acknowledgeWeeklyBonus: () => {
    warnMissingProvider();
  },
  createCharacter: async () => {
    warnMissingProvider();
    throw new Error(missingProviderMessage);
  },
  refreshCharacters: async () => {
    warnMissingProvider();
    return [];
  },
  refetch: async () => {
    warnMissingProvider();
  },
  resetCharacter: async () => {
    warnMissingProvider();
  },
  upsertSkillProgress: async () => {
    warnMissingProvider();
    return [];
  },
  upsertSkillUnlocks: async () => {
    warnMissingProvider();
    return [];
  },
};

const readStoredCharacterId = () => {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
  return value ?? null;
};

const writeStoredCharacterId = (characterId: string | null) => {
  if (typeof window === "undefined") return;
  if (characterId) {
    window.localStorage.setItem(CHARACTER_STORAGE_KEY, characterId);
  } else {
    window.localStorage.removeItem(CHARACTER_STORAGE_KEY);
  }
};

const readWeeklyBonusAcknowledgement = (profileId: string) => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`${WEEKLY_BONUS_ACK_STORAGE_PREFIX}${profileId}`);
};

const writeWeeklyBonusAcknowledgement = (profileId: string, timestamp: string | null) => {
  if (typeof window === "undefined") return;
  const storageKey = `${WEEKLY_BONUS_ACK_STORAGE_PREFIX}${profileId}`;
  if (timestamp) {
    window.localStorage.setItem(storageKey, timestamp);
  } else {
    window.localStorage.removeItem(storageKey);
  }
};

const isPostgrestError = (error: unknown): error is PostgrestError =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  "code" in error;

const extractErrorMessage = (error: unknown) => {
  if (isPostgrestError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return "An unknown error occurred.";
};

const sortProfiles = (profiles: PlayerProfile[]) => {
  const toTimestamp = (value: PlayerProfile["created_at"]) => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();

    const date = new Date(value as string);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };

  const getSlotNumber = (profile: PlayerProfile) => {
    const slot = (profile as Record<string, unknown>).slot_number;
    return typeof slot === "number" ? slot : null;
  };

  return [...profiles].sort((a, b) => {
    const slotA = getSlotNumber(a);
    const slotB = getSlotNumber(b);

    const hasSlotA = slotA !== null;
    const hasSlotB = slotB !== null;

    if (hasSlotA && hasSlotB) {
      if (slotA !== slotB) {
        return slotA - slotB;
      }
    } else if (hasSlotA) {
      return -1;
    } else if (hasSlotB) {
      return 1;
    }

    const createdAtA = toTimestamp(a.created_at);
    const createdAtB = toTimestamp(b.created_at);

    return createdAtA - createdAtB;
  });
};

const matchProgressToDefinition = (
  progress: SkillProgressRow,
  definition: SkillDefinition
) => progress.skill_id === definition.id || progress.skill_slug === definition.slug;

const XP_LEDGER_LIMIT = 20;

const ledgerTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortLedgerEntries = (entries: XpLedgerEntry[]) =>
  [...entries].sort((a, b) => ledgerTimestamp(b.created_at) - ledgerTimestamp(a.created_at));

type RefreshProgressionOptions = {
  ledgerEntries?: XpLedgerEntry[] | null;
  appendLedgerEntries?: XpLedgerEntry | XpLedgerEntry[] | null;
  refetchLedger?: boolean;
};

const mapWalletRowToSnapshot = (
  row: Tables<"player_xp_wallet"> | null | undefined,
  profileId: string
): PlayerXpWallet | null => {
  if (!row) {
    return null;
  }

  return {
    profile_id: row.profile_id ?? profileId,
    xp_balance: toSafeNumber(row.xp_balance),
    lifetime_xp: toSafeNumber(row.lifetime_xp),
    xp_spent: toSafeNumber(row.xp_spent),
    attribute_points_earned: toSafeNumber(row.attribute_points_earned),
    skill_points_earned: toSafeNumber(row.skill_points_earned),
    last_recalculated:
      typeof row.last_recalculated === "string" ? row.last_recalculated : null
  };
};

const useProvideGameData = (): GameDataContextValue => {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<PlayerProfile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(() => readStoredCharacterId());
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [skillDefinitions, setSkillDefinitions] = useState<any[]>([]);
  const [skillProgress, setSkillProgress] = useState<any[]>([]);
  const [skillUnlockRows, setSkillUnlockRows] = useState<any[]>([]);
  const [skillsUpdatedAt, setSkillsUpdatedAt] = useState<string | null>(null);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
  const [attributes, setAttributes] = useState<PlayerAttributes | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [xpLedger, setXpLedger] = useState<XpLedgerEntry[]>([]);
  const [xpWallet, setXpWallet] = useState<PlayerXpWallet | null>(null);
  const [progressionCooldowns, setProgressionCooldowns] = useState<ProgressionCooldowns>(
    createDefaultCooldownState
  );
  const [currentCity, setCurrentCity] = useState<Tables<"cities"> | null>(null);
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshWeeklyBonusAvailable, setFreshWeeklyBonusAvailable] = useState(false);
  const supportsProfileScopedDataRef = useRef<boolean | null>(null);
  const applyCooldownState = useCallback(
    (cooldowns?: ProgressionCooldowns | Record<string, number>) => {
      setProgressionCooldowns(() => {
        const next = createDefaultCooldownState();

        if (!cooldowns) {
          return next;
        }

        for (const key of PROGRESSION_COOLDOWN_KEYS) {
          const rawValue = (cooldowns as Record<string, unknown>)[key];
          const numericValue = toSafeNumber(rawValue, DEFAULT_PROGRESSION_COOLDOWNS[key]);
          next[key] = numericValue < 0 ? 0 : Math.floor(numericValue);
        }

        return next;
      });
    },
    []
  );

  const loadXpLedger = useCallback(
    async (profileId: string) => {
      const response = await supabase
        .from("xp_ledger")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(XP_LEDGER_LIMIT);

      if (response.error) {
        if (isMissingTableError(response.error)) {
          setXpLedger([]);
          return [] as XpLedgerEntry[];
        }

        throw response.error;
      }

      const data = sortLedgerEntries((response.data ?? []) as XpLedgerEntry[]);
      setXpLedger(data);
      return data;
    },
    []
  );

  const clearGameState = useCallback(() => {
    setProfile(null);
    setSkills(null);
    setAttributes(null);
    setXpWallet(null);
    setActivities([]);
    setXpLedger([]);
    applyCooldownState();
    setCurrentCity(null);
    setFreshWeeklyBonusAvailable(false);
  }, [applyCooldownState]);

  const fetchCharacters = useCallback(async () => {
    if (!user) {
      setCharacters([]);
      setSelectedCharacterId(null);
      clearGameState();
      setError(null);
      return [] as PlayerProfile[];
    }

    setCharactersLoading(true);
    setError(null);

    try {
      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id);

      if (profilesError) throw profilesError;

      const list = sortProfiles(data ?? []);
      setCharacters(list);

      const hasStored = selectedCharacterId && list.some(character => character.id === selectedCharacterId);
      const activeCharacterId = list.find(character => character.is_active)?.id ?? null;
      const fallbackId = hasStored
        ? selectedCharacterId
        : activeCharacterId ?? list[0]?.id ?? null;

      if (fallbackId !== selectedCharacterId) {
        setSelectedCharacterId(fallbackId);
        writeStoredCharacterId(fallbackId);
      }

      if (!fallbackId) {
        clearGameState();
      }

      return list;
    } catch (err: unknown) {
      console.error("Error fetching characters:", err);
      setError(extractErrorMessage(err));
      return [] as PlayerProfile[];
    } finally {
      setCharactersLoading(false);
    }
  }, [user, selectedCharacterId, clearGameState]);

  const resolveCurrentCity = useCallback(
    async (cityId: Nullable<string>) => {
      if (!cityId) {
        setCurrentCity(null);
        return;
      }

      const { data, error: cityError, status } = await supabase
        .from("cities")
        .select("*")
        .eq("id", cityId)
        .maybeSingle();

      if (cityError && status !== 406) {
        console.error("Error fetching current city:", cityError);
        return;
      }

      setCurrentCity(data ?? null);
    },
    [setAttributes, setProfile, setProgressionCooldowns, setXpWallet]
  );

  const fetchGameData = useCallback(async () => {
    if (!user || !selectedCharacterId) {
      clearGameState();
      setDataLoading(false);
      setError(null);
      return;
    }

    setDataLoading(true);
    setError(null);

    try {
      const profileResponse = await supabase
        .from("profiles")
        .select("*")
        .eq("id", selectedCharacterId)
        .maybeSingle();

      if (profileResponse.error && profileResponse.status !== 406) {
        throw profileResponse.error;
      }

      const character = profileResponse.data ?? null;

      if (!character) {
        clearGameState();
        setError("The selected character could not be found.");
        setSelectedCharacterId(null);
        writeStoredCharacterId(null);
        await fetchCharacters();
        return;
      }

      setProfile(character);
      applyCooldownState();
      await resolveCurrentCity(character.current_city_id ?? null);

      const walletResponse = await supabase
        .from("player_xp_wallet")
        .select(
          "profile_id, xp_balance, lifetime_xp, xp_spent, attribute_points_earned, skill_points_earned, last_recalculated"
        )
        .eq("profile_id", selectedCharacterId)
        .maybeSingle();

      let walletData: PlayerXpWallet | null = null;

      if (walletResponse.error) {
        if (
          walletResponse.status === 404 ||
          walletResponse.status === 406 ||
          walletResponse.error.code === "PGRST116" ||
          isMissingTableError(walletResponse.error) ||
          isMissingColumnError(walletResponse.error, "profile_id")
        ) {
          walletData = null;
        } else {
          throw walletResponse.error;
        }
      } else if (walletResponse.data) {
        walletData = mapWalletRowToSnapshot(walletResponse.data, character.id);
      }

      setXpWallet(walletData);

      let skillsResponse: PostgrestMaybeSingleResponse<PlayerSkills> | undefined;

      if (supportsProfileScopedDataRef.current === false) {
        skillsResponse = await supabase
          .from("player_skills")
          .select("*")
          .eq("user_id", character.user_id)
          .maybeSingle();

        if (skillsResponse.error && skillsResponse.status !== 406) {
          throw skillsResponse.error;
        }
      } else {
        const attempt = await supabase
          .from("player_skills")
          .select("*")
          .eq("profile_id", selectedCharacterId)
          .maybeSingle();

        if (attempt.error) {
          if (isMissingColumnError(attempt.error, "profile_id")) {
            supportsProfileScopedDataRef.current = false;
            skillsResponse = await supabase
              .from("player_skills")
              .select("*")
              .eq("user_id", character.user_id)
              .maybeSingle();

            if (skillsResponse.error && skillsResponse.status !== 406) {
              throw skillsResponse.error;
            }
          } else if (attempt.status !== 406) {
            throw attempt.error;
          } else {
            skillsResponse = attempt;
          }
        } else {
          supportsProfileScopedDataRef.current = true;
          skillsResponse = attempt;
        }
      }

      let skillsData = skillsResponse?.data ?? null;

      if (!skillsData) {
        const baseSkillPayload: Record<string, unknown> = {
          user_id: character.user_id,
          profile_id: character.id
        };

        const initialSkillPayload =
          supportsProfileScopedDataRef.current === false
            ? omitFromRecord(baseSkillPayload, "profile_id")
            : baseSkillPayload;

        const insertedSkills = await supabase
          .from("player_skills")
          .insert(initialSkillPayload)
          .select()
          .single();

        if (insertedSkills.error) {
          if (isMissingColumnError(insertedSkills.error, "profile_id")) {
            supportsProfileScopedDataRef.current = false;
            const fallbackInsert = await supabase
              .from("player_skills")
              .insert(omitFromRecord(baseSkillPayload, "profile_id"))
              .select()
              .single();

            if (fallbackInsert.error) {
              throw fallbackInsert.error;
            }

            skillsData = fallbackInsert.data;
          } else {
            throw insertedSkills.error;
          }
        } else {
          skillsData = insertedSkills.data;
        }
      }

      setSkills(skillsData);

      const definitions: AttributeDefinition[] = [];
      setAttributeDefinitions(definitions);

      const profileAttributeRows: ProfileAttribute[] = [];
      const definitionById = new Map(definitions.map(definition => [definition.id, definition]));

      const resolvedAttributes = profileAttributeRows.reduce<Record<string, number>>((acc, row) => {
        const definition = definitionById.get(row.attribute_id);
        if (definition) {
          acc[definition.slug] = Number(row.value ?? definition.default_value ?? 0);
        }
        return acc;
      }, {});

      let attributesResponse: PostgrestMaybeSingleResponse<PlayerAttributes> | undefined;

      if (supportsProfileScopedDataRef.current === false) {
        attributesResponse = await supabase
          .from("player_attributes")
          .select("*")
          .eq("user_id", character.user_id)
          .maybeSingle();
      } else {
        const attempt = await supabase
          .from("player_attributes")
          .select("*")
          .eq("profile_id", selectedCharacterId)
          .maybeSingle();

        if (attempt.error) {
          if (isMissingColumnError(attempt.error, "profile_id")) {
            supportsProfileScopedDataRef.current = false;
            attributesResponse = await supabase
              .from("player_attributes")
              .select("*")
              .eq("user_id", character.user_id)
              .maybeSingle();
          } else if (
            attempt.error.code !== "PGRST116" &&
            attempt.status !== 406
          ) {
            throw attempt.error;
          } else {
            attributesResponse = attempt;
          }
        } else {
          supportsProfileScopedDataRef.current = true;
          attributesResponse = attempt;
        }
      }

      if (
        attributesResponse?.error &&
        attributesResponse.error.code !== "PGRST116" &&
        attributesResponse.status !== 406
      ) {
        throw attributesResponse.error;
      }

      let attributesData = attributesResponse?.data ?? null;

      if (!attributesData) {
        const baseAttributePayload: Record<string, unknown> = {
          user_id: character.user_id,
          profile_id: character.id,
          attribute_points: 0,
        };

        ATTRIBUTE_KEYS.forEach((key: AttributeKey) => {
          const rawValue = resolvedAttributes[key];
          baseAttributePayload[key] = clampAttributeValue(
            typeof rawValue === "number" ? rawValue : 0,
          );
        });

        let attemptedAttributePayload: Record<string, unknown> = {
          ...baseAttributePayload,
        };
        const skippedAttributeColumns = new Set<string>();

        while (Object.keys(attemptedAttributePayload).length > 0) {
          const payloadToInsert =
            supportsProfileScopedDataRef.current === false
              ? omitFromRecord(attemptedAttributePayload, "profile_id")
              : attemptedAttributePayload;

          const insertedAttributes = await supabase
            .from("player_attributes")
            .insert(payloadToInsert)
            .select()
            .single();

          if (!insertedAttributes.error) {
            attributesData = insertedAttributes.data;
            break;
          }

          if (
            isMissingColumnError(insertedAttributes.error, "profile_id") &&
            supportsProfileScopedDataRef.current !== false
          ) {
            supportsProfileScopedDataRef.current = false;
            continue;
          }

          if (insertedAttributes.error.code === "42703") {
            const missingColumn = extractMissingColumn(insertedAttributes.error);
            if (
              missingColumn &&
              missingColumn !== "profile_id" &&
              !skippedAttributeColumns.has(missingColumn) &&
              missingColumn in attemptedAttributePayload
            ) {
              skippedAttributeColumns.add(missingColumn);
              attemptedAttributePayload = omitFromRecord(
                attemptedAttributePayload,
                missingColumn,
              );
              continue;
            }
          }

          throw insertedAttributes.error;
        }
      }

      setAttributes(attributesData ?? null);

      let activityResponse = await supabase
        .from("activity_feed")
        .select("*")
        .eq("profile_id", selectedCharacterId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (activityResponse.error) {
        if (isMissingColumnError(activityResponse.error, "profile_id")) {
          supportsProfileScopedDataRef.current = false;
          activityResponse = await supabase
            .from("activity_feed")
            .select("*")
            .eq("user_id", character.user_id)
            .order("created_at", { ascending: false })
            .limit(10);

          if (activityResponse.error) {
            throw activityResponse.error;
          }
        } else {
          throw activityResponse.error;
        }
      } else {
        supportsProfileScopedDataRef.current = true;
      }

      setActivities(activityResponse.data ?? []);

      await loadXpLedger(character.id);

      const [skillDefinitionsResponse, skillProgressResponse] = await Promise.all([
        supabase.from("skill_definitions").select("*"),
        supabase
          .from("profile_skill_progress")
          .select("*")
          .eq("profile_id", selectedCharacterId)
      ]);

      const sortedSkillDefinitions = sortByOptionalKeys(
        ((skillDefinitionsResponse.data ?? []) as SkillDefinition[]).filter(Boolean),
        ["display_order", "sort_order", "order_index", "position"],
        ["name", "slug"]
      ) as SkillDefinition[];

      setSkillDefinitions(sortedSkillDefinitions);

      let skillProgressData: SkillProgressRow[] = [];

      if (skillProgressResponse.error) {
        if (
          skillProgressResponse.status === 404 ||
          isMissingTableError(skillProgressResponse.error) ||
          isMissingColumnError(skillProgressResponse.error, "profile_id")
        ) {
          if (isMissingColumnError(skillProgressResponse.error, "profile_id")) {
            supportsProfileScopedDataRef.current = false;
          }
          skillProgressData = [];
        } else {
          throw skillProgressResponse.error;
        }
      } else {
        skillProgressData = (skillProgressResponse.data ?? []) as SkillProgressRow[];
      }

      setSkillProgress(skillProgressData);
      setSkillUnlockRows([]);
    } catch (err) {
      console.error("Error fetching game data:", err);
      setError(extractErrorMessage(err));
    } finally {
      setDataLoading(false);
    }
  }, [
    user,
    selectedCharacterId,
    clearGameState,
    fetchCharacters,
    resolveCurrentCity,
    loadXpLedger
  ]);

  useEffect(() => {
    if (!user) {
      setCharacters([]);
      setSelectedCharacterId(null);
      writeStoredCharacterId(null);
      clearGameState();
      setError(null);
      setCharactersLoading(false);
      setDataLoading(false);
      return;
    }

    void fetchCharacters();
  }, [clearGameState, fetchCharacters, user]);

  useEffect(() => {
    writeStoredCharacterId(selectedCharacterId);
    void fetchGameData();
  }, [fetchGameData, selectedCharacterId]);

  const acknowledgeWeeklyBonus = useCallback(() => {
    if (!profile?.id) {
      return;
    }

    const latestWeeklyBonus = xpLedger.find(
      entry => entry.event_type === WEEKLY_BONUS_REASON
    );
    const acknowledgementTimestamp = resolveWeeklyBonusAcknowledgementTimestamp(latestWeeklyBonus);
    writeWeeklyBonusAcknowledgement(profile.id, acknowledgementTimestamp);
    setFreshWeeklyBonusAvailable(false);
  }, [profile, xpLedger]);

  useEffect(() => {
    if (!profile?.id) {
      setFreshWeeklyBonusAvailable(false);
      return;
    }

    const latestWeeklyBonus = xpLedger.find(
      entry => entry.event_type === WEEKLY_BONUS_REASON
    );
    const acknowledgement = readWeeklyBonusAcknowledgement(profile.id);
    const { freshWeeklyBonusAvailable: hasFreshBonus, acknowledgementToPersist } =
      evaluateWeeklyBonusState(latestWeeklyBonus, acknowledgement);

    setFreshWeeklyBonusAvailable(hasFreshBonus);

    if (acknowledgementToPersist !== undefined) {
      writeWeeklyBonusAcknowledgement(profile.id, acknowledgementToPersist);
    }
  }, [profile, xpLedger]);

  const setActiveCharacter = useCallback(
    async (characterId: string) => {
      if (!user) {
        throw new Error("You must be signed in to select a character.");
      }

      setSelectedCharacterId(characterId);
      writeStoredCharacterId(characterId);

      try {
        await supabase
          .from("profiles")
          .update({ is_active: false })
          .eq("user_id", user.id);

        await supabase
          .from("profiles")
          .update({ is_active: true })
          .eq("id", characterId);
      } catch (err) {
        console.error("Error setting active character:", err);
      }

      await fetchGameData();
    },
    [user, fetchGameData]
  );

  const clearSelectedCharacter = useCallback(() => {
    setSelectedCharacterId(null);
    writeStoredCharacterId(null);
    clearGameState();
  }, [clearGameState]);

  const applyProgressionResult = useCallback(
    (response: ProgressionResponse) => {
      if (response?.profile && typeof response.profile === "object") {
        const patch = response.profile as Partial<PlayerProfile>;
        setProfile(prev => (prev ? { ...prev, ...patch } : (patch as PlayerProfile)));
      }

      if ("wallet" in response) {
        setXpWallet(prev => {
          const wallet = response.wallet as PlayerXpWallet | null | undefined;
          if (wallet === undefined) {
            return prev;
          }
          if (wallet === null) {
            return null;
          }
          return { ...(prev ?? {}), ...wallet } as PlayerXpWallet;
        });
      }

      if (response.attributes && typeof response.attributes === "object") {
        setAttributes((prev: PlayerAttributes | null) => ({
          ...(prev ?? {}),
          ...(response.attributes as PlayerAttributes),
        }));
      }

      const ledgerEntries = extractLedgerEntriesFromResult(response.result);
      if (ledgerEntries.length > 0) {
        setExperienceLedger(prev => {
          const byId = new Map<string, ExperienceLedgerEntry>();
          for (const entry of ledgerEntries) {
            if (entry?.id) {
              byId.set(entry.id, entry);
            }
          }

          for (const entry of prev) {
            if (entry?.id && !byId.has(entry.id)) {
              byId.set(entry.id, entry);
            }
          }

          const combined = Array.from(byId.values()).sort((a, b) => {
            const aTime = a.recorded_at ? new Date(a.recorded_at).getTime() : 0;
            const bTime = b.recorded_at ? new Date(b.recorded_at).getTime() : 0;
            return bTime - aTime;
          });

          return combined.slice(0, 20);
        });
      }
    },
    [],
  );

  const invokeProgressionMutation = useCallback(
    async (
      action: string,
      body: Record<string, unknown>,
    ): Promise<ProgressionActionSuccessResponse> => {
      const { data, error } = await supabase.functions.invoke<ProgressionActionResponse>(
        `progression/${action}`,
        { body }
      );

      if (error) {
        throw Object.assign(new Error(error.message ?? "Progression request failed"), {
          code: (error as { code?: string }).code ?? (error.status ? String(error.status) : undefined),
          details: (error as { details?: unknown }).details ?? null,
          hint: (error as { hint?: string }).hint ?? null,
        });
      }

      if (!data) {
        throw new Error("Progression service returned an empty response");
      }

      if (!data.success) {
        const failure = data;
        throw Object.assign(new Error(failure.message ?? "Progression update rejected"), {
          details: failure.details ?? null,
        });
      }

      return data;
    },
    []
  );

  const updateProfile = useCallback(
    async (updates: Partial<PlayerProfile>) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      const basePayload = {
        ...updates,
        updated_at: updates.updated_at ?? new Date().toISOString(),
      };

      let attemptedPayload: Record<string, unknown> = Object.fromEntries(
        Object.entries(basePayload).filter(([, value]) => value !== undefined)
      );
      const skippedColumns = new Set<string>();

      while (Object.keys(attemptedPayload).length > 0) {
        try {
          const response = await invokeProgressionMutation("update_profile", {
            profile_id: selectedCharacterId,
            user_id: user.id,
            updates: attemptedPayload,
          });

          applyProgressionResult(response);

          let resolvedProfile: PlayerProfile | null = null;
          setProfile(prev => {
            const baseProfile = prev ?? null;

            if (!baseProfile) {
              const fallbackProfile = {
                id: selectedCharacterId,
                ...(attemptedPayload as Partial<PlayerProfile>),
                ...(response.profile as Partial<PlayerProfile> | null | undefined),
              } as PlayerProfile;
              resolvedProfile = fallbackProfile;
              return fallbackProfile;
            }

            const nextProfile = {
              ...baseProfile,
              ...(attemptedPayload as Partial<PlayerProfile>),
            } as PlayerProfile;

            if (response.profile) {
              Object.assign(nextProfile, response.profile as Partial<PlayerProfile>);
            }

            resolvedProfile = nextProfile;
            return nextProfile;
          });

          return resolvedProfile ?? undefined;
        } catch (error) {
          const missingColumn = extractMissingColumn(error as PostgrestError | null | undefined);
          if (
            missingColumn &&
            !skippedColumns.has(missingColumn) &&
            missingColumn in attemptedPayload
          ) {
            skippedColumns.add(missingColumn);
            attemptedPayload = omitFromRecord(attemptedPayload, missingColumn);
            continue;
          }

          console.error("Error updating profile via progression:", error);
          throw error;
        }
      }

      return undefined;
    },
    [applyProgressionResult, invokeProgressionMutation, selectedCharacterId, user]
  );

  const awardActionXp = useCallback(
    async (input: AwardActionXpInput) => {
      const response = await progressionClient.awardActionXp(input);
      applyProgressionResult(response);
      return response;
    },
    [applyProgressionResult]
  );

  const buyAttributeStar = useCallback(
    async (input: BuyAttributeStarInput) => {
      const response = await progressionClient.buyAttributeStar(input);
      applyProgressionResult(response);
      return response;
    },
    [applyProgressionResult]
  );

  const updateSkills = useCallback(
    async (updates: Partial<PlayerSkills>) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      const payload = {
        ...updates,
        updated_at: updates.updated_at ?? new Date().toISOString(),
      };

      const attemptedPayload: Record<string, unknown> = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
      );

      const preferredScope = supportsProfileScopedDataRef.current === false ? "user" : "profile";
      const scopes: Array<"profile" | "user"> =
        preferredScope === "profile" ? ["profile", "user"] : ["user", "profile"];

      const extractSkillsPatch = (result: unknown): Partial<PlayerSkills> | null => {
        if (!result || typeof result !== "object") {
          return null;
        }

        const record = result as Record<string, unknown>;
        const candidates = [
          record.skills,
          record.player_skills,
          record.playerSkills,
        ];

        for (const candidate of candidates) {
          if (candidate && typeof candidate === "object") {
            return candidate as Partial<PlayerSkills>;
          }
        }

        return null;
      };

      for (const scope of scopes) {
        try {
          const response = await invokeProgressionMutation("update_skills", {
            profile_id: selectedCharacterId,
            user_id: user.id,
            scope,
            updates: attemptedPayload,
          });

          supportsProfileScopedDataRef.current = scope === "profile";

          applyProgressionResult(response);

          const skillsPatch = extractSkillsPatch(response.result);
          let resolvedSkills: PlayerSkills | null = null;

          setSkills(prev => {
            const baseSkills = prev ?? null;

            if (!baseSkills) {
              if (skillsPatch) {
                const merged = skillsPatch as PlayerSkills;
                resolvedSkills = merged;
                return merged;
              }

              const fallback = {
                profile_id: selectedCharacterId,
                ...(attemptedPayload as Partial<PlayerSkills>),
              } as PlayerSkills;
              resolvedSkills = fallback;
              return fallback;
            }

            const nextSkills = {
              ...baseSkills,
              ...(attemptedPayload as Partial<PlayerSkills>),
            } as PlayerSkills;

            if (skillsPatch) {
              Object.assign(nextSkills, skillsPatch);
            }

            resolvedSkills = nextSkills;
            return nextSkills;
          });

          return resolvedSkills ?? undefined;
        } catch (error) {
          if (
            scope === "profile" &&
            isMissingColumnError(error as PostgrestError | null | undefined, "profile_id")
          ) {
            supportsProfileScopedDataRef.current = false;
            continue;
          }

          console.error("Error updating skills via progression:", error);
          throw error;
        }
      }

      return undefined;
    },
    [applyProgressionResult, invokeProgressionMutation, selectedCharacterId, user]
  );

  const updateAttributes = useCallback(
    async (updates: Partial<PlayerAttributes>) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      const payload = {
        ...updates,
        updated_at: updates.updated_at ?? new Date().toISOString(),
      };

      const attemptedPayload: Record<string, unknown> = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
      );

      const preferredScope = supportsProfileScopedDataRef.current === false ? "user" : "profile";
      const scopes: Array<"profile" | "user"> =
        preferredScope === "profile" ? ["profile", "user"] : ["user", "profile"];

      for (const scope of scopes) {
        try {
          const response = await invokeProgressionMutation("update_attributes", {
            profile_id: selectedCharacterId,
            user_id: user.id,
            scope,
            updates: attemptedPayload,
          });

          supportsProfileScopedDataRef.current = scope === "profile";

          applyProgressionResult(response);

          let resolvedAttributes: PlayerAttributes | null = null;

          setAttributes(prev => {
            const baseAttributes = prev ?? null;

            if (!baseAttributes) {
              if (response.attributes && typeof response.attributes === "object") {
                const merged = response.attributes as PlayerAttributes;
                resolvedAttributes = merged;
                return merged;
              }

              const fallback = {
                profile_id: selectedCharacterId,
                user_id: user.id,
                ...(attemptedPayload as Partial<PlayerAttributes>),
              } as PlayerAttributes;
              resolvedAttributes = fallback;
              return fallback;
            }

            const nextAttributes = {
              ...baseAttributes,
              ...(attemptedPayload as Partial<PlayerAttributes>),
            } as PlayerAttributes;

            if (response.attributes && typeof response.attributes === "object") {
              Object.assign(nextAttributes, response.attributes as Partial<PlayerAttributes>);
            }

            resolvedAttributes = nextAttributes;
            return nextAttributes;
          });

          return resolvedAttributes ?? undefined;
        } catch (error) {
          if (
            scope === "profile" &&
            isMissingColumnError(error as PostgrestError | null | undefined, "profile_id")
          ) {
            supportsProfileScopedDataRef.current = false;
            continue;
          }

          console.error("Error updating attributes via progression:", error);
          throw error;
        }
      }

      return undefined;
    },
    [applyProgressionResult, invokeProgressionMutation, selectedCharacterId, user]
  );

  const setSkillUnlocked = useCallback(
    async (skillSlug: string, unlocked: boolean) => {
      if (!user) {
        throw new Error("You must be signed in to update skill unlocks.");
      }

      const activeProfileId = selectedCharacterId;
      if (!activeProfileId) {
        throw new Error("No active character selected.");
      }

      const definition = skillDefinitions.find(def => def.slug === skillSlug || def.id === skillSlug);
      if (!definition) {
        throw new Error(`Unknown skill: ${skillSlug}`);
      }

      if (unlocked) {
        // Note: profile_skill_unlocks table not implemented yet
        console.log("Would unlock skill:", definition.id);

      } else {
        // Note: profile_skill_unlocks table not implemented yet
        console.log("Would lock skill:", definition.id);

      }
    },
    [selectedCharacterId, skillDefinitions, user]
  );

  const addActivity = useCallback(
    async (
      activityType: string,
      message: string,
      earnings: number = 0,
      metadata?: ActivityItem["metadata"]
    ) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      const baseActivityPayload: Record<string, unknown> = {
        user_id: user.id,
        profile_id: selectedCharacterId,
        activity_type: activityType,
        message,
        earnings,
        metadata: metadata ?? null
      };

      const initialActivityPayload =
        supportsProfileScopedDataRef.current === false
          ? omitFromRecord(baseActivityPayload, "profile_id")
          : baseActivityPayload;

      let insertResponse = await supabase
        .from("activity_feed")
        .insert(initialActivityPayload)
        .select()
        .single();

      if (insertResponse.error) {
        if (isMissingColumnError(insertResponse.error, "profile_id")) {
          supportsProfileScopedDataRef.current = false;
          insertResponse = await supabase
            .from("activity_feed")
            .insert(omitFromRecord(baseActivityPayload, "profile_id"))
            .select()
            .single();
        } else {
          console.error("Error adding activity:", insertResponse.error);
          throw insertResponse.error;
        }
      } else {
        supportsProfileScopedDataRef.current = true;
      }

      const data = insertResponse.data;

      if (!data) {
        throw new Error("No activity data returned from Supabase.");
      }

      setActivities(prev => [data, ...prev.slice(0, 9)]);
      return data;
    },
    [selectedCharacterId, user]
  );

  const applyProgressionUpdate = useCallback(
    (response: ProgressionActionSuccessResponse) => {
      if (!response?.success) {
        return;
      }

      const { profile: profileSnapshot, wallet, attributes: attributeSnapshot, cooldowns } = response;
      const walletXp = wallet?.xp_balance;

      if (profileSnapshot) {
        setProfile(prev => {
          const mergedProfile = prev
            ? ({ ...prev, ...profileSnapshot } as PlayerProfile)
            : (profileSnapshot as PlayerProfile);

          if (walletXp != null) {
            return { ...mergedProfile, experience: walletXp } as PlayerProfile;
          }

          return mergedProfile;
        });
      } else if (walletXp != null) {
        setProfile(prev => {
          if (!prev) {
            return prev;
          }
          return { ...prev, experience: walletXp } as PlayerProfile;
        });
      }

      setXpWallet(wallet ?? null);

      if (attributeSnapshot) {
        setAttributes(prev => {
          if (prev) {
            return { ...prev, ...attributeSnapshot } as PlayerAttributes;
          }
          return attributeSnapshot as PlayerAttributes;
        });
      }

      setProgressionCooldowns(cooldowns ?? {});
    },
    []
  );

  const fetchProgressionSnapshot = useCallback(async (): Promise<ProgressionSnapshot | null> => {
    if (!user || !selectedCharacterId) {
      return null;
    }

    try {
      const [profileResponse, walletResponse] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", selectedCharacterId)
          .maybeSingle(),
        supabase
          .from("player_xp_wallet")
          .select("*")
          .eq("profile_id", selectedCharacterId)
          .maybeSingle(),
      ]);

      if (profileResponse.error && profileResponse.status !== 406) {
        throw profileResponse.error;
      }

      if (
        walletResponse.error &&
        walletResponse.error.code !== "PGRST116" &&
        walletResponse.status !== 406
      ) {
        throw walletResponse.error;
      }

      let attributesResponse: PostgrestMaybeSingleResponse<PlayerAttributes> | undefined;

      if (supportsProfileScopedDataRef.current === false) {
        attributesResponse = await supabase
          .from("player_attributes")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
      } else {
        const attempt = await supabase
          .from("player_attributes")
          .select("*")
          .eq("profile_id", selectedCharacterId)
          .maybeSingle();

        if (attempt.error) {
          if (isMissingColumnError(attempt.error, "profile_id")) {
            supportsProfileScopedDataRef.current = false;
            attributesResponse = await supabase
              .from("player_attributes")
              .select("*")
              .eq("user_id", user.id)
              .maybeSingle();
          } else if (attempt.error.code === "PGRST116" || attempt.status === 406) {
            attributesResponse = attempt;
          } else {
            throw attempt.error;
          }
        } else {
          supportsProfileScopedDataRef.current = true;
          attributesResponse = attempt;
        }
      }

      if (
        attributesResponse?.error &&
        attributesResponse.error.code !== "PGRST116" &&
        attributesResponse.status !== 406
      ) {
        throw attributesResponse.error;
      }

      const nextProfile = profileResponse.data ?? null;
      const nextWallet = walletResponse.data ?? null;
      const nextAttributes = attributesResponse?.data ?? null;
      const walletXp = nextWallet?.xp_balance;

      if (nextProfile || walletXp != null) {
        setProfile(prev => {
          if (nextProfile) {
            const resolvedProfile = walletXp != null
              ? ({ ...nextProfile, experience: walletXp } as PlayerProfile)
              : (nextProfile as PlayerProfile);
            return resolvedProfile;
          }

          if (prev && walletXp != null) {
            return { ...prev, experience: walletXp } as PlayerProfile;
          }

          return prev ?? null;
        });
      }

      setXpWallet(nextWallet);

      if (nextAttributes) {
        setAttributes(nextAttributes);
      }

      return {
        profile: nextProfile
          ? (walletXp != null
              ? ({ ...nextProfile, experience: walletXp } as PlayerProfile)
              : nextProfile)
          : profile
            ? (walletXp != null
                ? ({ ...profile, experience: walletXp } as PlayerProfile)
                : profile)
            : null,
        wallet: nextWallet,
        attributes: nextAttributes ?? attributes ?? null,
      };
    } catch (refreshError) {
      console.error("Error refreshing progression state:", refreshError);
      return null;
    }
  }, [attributes, profile, selectedCharacterId, user]);
  const createCharacter = useCallback(
    async ({
      username,
      displayName,
      slotNumber,
      unlockCost,
      makeActive = false
    }: CreateCharacterInput) => {
      if (!user) {
        throw new Error("You must be signed in to create a character.");
      }

      setCharactersLoading(true);

      try {
        if (unlockCost > 0) {
          if (!profile || (profile.cash ?? 0) < unlockCost) {
            throw new Error("You do not have enough cash to unlock this character slot.");
          }

          await updateProfile({ cash: (profile.cash ?? 0) - unlockCost });
        }

        const baseProfilePayload: Record<string, unknown> = {
          user_id: user.id,
          username,
          display_name: displayName,
          slot_number: slotNumber,
          unlock_cost: unlockCost,
          is_active: makeActive
        };

        const skippedProfileColumns = new Set<string>();
        let attemptedProfilePayload = { ...baseProfilePayload };
        let newProfile: PlayerProfile | null = null;

        while (Object.keys(attemptedProfilePayload).length > 0) {
          const { data, error } = await supabase
            .from("profiles")
            .insert(attemptedProfilePayload)
            .select()
            .single();

          if (!error) {
            newProfile = data ?? null;
            break;
          }

          const missingColumn = extractMissingColumn(error);
          if (
            missingColumn &&
            !skippedProfileColumns.has(missingColumn) &&
            missingColumn in attemptedProfilePayload
          ) {
            skippedProfileColumns.add(missingColumn);
            attemptedProfilePayload = omitFromRecord(
              attemptedProfilePayload,
              missingColumn
            );
            continue;
          }

          throw error;
        }

        if (!newProfile) {
          throw new Error("Failed to create character profile.");
        }

        const baseNewSkillPayload: Record<string, unknown> = {
          user_id: user.id,
          profile_id: newProfile.id
        };

        const initialNewSkillPayload =
          supportsProfileScopedDataRef.current === false
            ? omitFromRecord(baseNewSkillPayload, "profile_id")
            : baseNewSkillPayload;

        const { error: skillsInsertError } = await supabase
          .from("player_skills")
          .insert(initialNewSkillPayload);

        if (skillsInsertError) {
          if (isMissingColumnError(skillsInsertError, "profile_id")) {
            supportsProfileScopedDataRef.current = false;
            const { error: fallbackSkillError } = await supabase
              .from("player_skills")
              .insert(omitFromRecord(baseNewSkillPayload, "profile_id"));

            if (fallbackSkillError) {
              throw fallbackSkillError;
            }
          } else {
            throw skillsInsertError;
          }
        } else {
          supportsProfileScopedDataRef.current = true;
        }

        if (skillDefinitions.length > 0) {
          await Promise.all([
            upsertSkillProgress(newProfile.id, []),
            upsertSkillUnlocks(newProfile.id, [])
          ]);
        } else {
          setSkillProgress([]);
          setSkillUnlockRows([]);
        }

        if (attributeDefinitions.length > 0) {
          const baseNewAttributePayload: Record<string, unknown> = {
            user_id: user.id,
            profile_id: newProfile.id
          };

          const initialNewAttributePayload =
            supportsProfileScopedDataRef.current === false
              ? omitFromRecord(baseNewAttributePayload, "profile_id")
              : baseNewAttributePayload;

          const { error: attributeInsertError } = await supabase
            .from("player_attributes")
            .insert(initialNewAttributePayload);

          if (attributeInsertError) {
            if (isMissingColumnError(attributeInsertError, "profile_id")) {
              supportsProfileScopedDataRef.current = false;
              const { error: fallbackAttributeError } = await supabase
                .from("player_attributes")
                .insert(omitFromRecord(baseNewAttributePayload, "profile_id"));

              if (fallbackAttributeError) {
                throw fallbackAttributeError;
              }
            } else {
              throw attributeInsertError;
            }
          } else {
            supportsProfileScopedDataRef.current = true;
          }
        }

        setCharacters(prev => [...prev, newProfile]);

        if (makeActive || !selectedCharacterId) {
          await setActiveCharacter(newProfile.id);
        }

        return newProfile;
      } catch (err) {
        console.error("Error creating character:", err);
        setError(extractErrorMessage(err));
        throw err;
      } finally {
        setCharactersLoading(false);
      }
    },
    [profile, selectedCharacterId, setActiveCharacter, updateProfile, user, skillDefinitions, attributeDefinitions]
  );

  const refreshCharacters = useCallback(() => fetchCharacters(), [fetchCharacters]);

  const refetch = useCallback(() => fetchGameData(), [fetchGameData]);

  const resetCharacter = useCallback(async () => {
    if (!user) {
      throw new Error("You must be signed in to reset a character.");
    }

    const { data, error: resetError } = await supabase.rpc("reset_player_character");

    if (resetError) {
      console.error("Error resetting character:", resetError);
      throw resetError;
    }

    const nextProfileId = Array.isArray(data) && data.length > 0 ? data[0]?.profile?.id ?? null : null;
    if (nextProfileId) {
      setSelectedCharacterId(nextProfileId);
      writeStoredCharacterId(nextProfileId);
    } else {
      clearSelectedCharacter();
    }

    await fetchCharacters();
    await fetchGameData();
  }, [clearSelectedCharacter, fetchCharacters, fetchGameData, user]);

  const refreshProgressionState = useCallback(
    async (
      snapshotOrResult?: ProgressionStateSnapshot | ProgressionFunctionResult | null,
      options?: RefreshProgressionOptions
    ) => {
      let snapshot =
        snapshotOrResult && "state" in (snapshotOrResult as ProgressionFunctionResult)
          ? (snapshotOrResult as ProgressionFunctionResult).state
          : (snapshotOrResult as ProgressionStateSnapshot | null | undefined) ?? null;

      if (!snapshot) {
        const fetched = await fetchProgressionSnapshot();
        snapshot = (fetched as ProgressionStateSnapshot | null | undefined) ?? null;
      }

      if (snapshot) {
        const nextProfile = snapshot.profile;
        if (nextProfile) {
          setProfile(prev => {
            if (!prev) {
              return nextProfile as unknown as PlayerProfile;
            }
            return { ...prev, ...nextProfile } as PlayerProfile;
          });
        }

        setXpWallet(snapshot.wallet ?? null);
        setAttributes(snapshot.attributes ?? null);
        const maybeCooldowns = (snapshot as { cooldowns?: ProgressionCooldowns | Record<string, number> }).cooldowns;
        if (maybeCooldowns) {
          applyCooldownState(maybeCooldowns);
        } else {
          applyCooldownState();
        }
      } else {
        applyCooldownState();
      }

      if (options?.ledgerEntries !== undefined) {
        setXpLedger(sortLedgerEntries(options.ledgerEntries ?? []).slice(0, XP_LEDGER_LIMIT));
      } else if (options?.appendLedgerEntries) {
        const appendList = Array.isArray(options.appendLedgerEntries)
          ? options.appendLedgerEntries
          : [options.appendLedgerEntries];

        const entriesToAdd = appendList.filter(
          (entry): entry is XpLedgerEntry => Boolean(entry)
        );

        if (entriesToAdd.length > 0) {
          setXpLedger(prev => {
            const seen = new Set(prev.map(entry => entry.id));
            const deduped = entriesToAdd.filter(entry => {
              if (seen.has(entry.id)) {
                return false;
              }
              seen.add(entry.id);
              return true;
            });

            if (deduped.length === 0) {
              return prev;
            }

            const merged = [...deduped, ...prev];
            return sortLedgerEntries(merged).slice(0, XP_LEDGER_LIMIT);
          });
        }
      } else if (options?.refetchLedger) {
        const targetProfileId = snapshot?.profile?.id ?? profile?.id ?? selectedCharacterId;
        if (targetProfileId) {
          await loadXpLedger(targetProfileId);
        }
      } else if (!snapshot && selectedCharacterId) {
        await loadXpLedger(selectedCharacterId);
      }
    },
    [applyCooldownState, fetchProgressionSnapshot, loadXpLedger, profile, selectedCharacterId]
  );

  const upsertSkillProgress = useCallback(
    async (profileId: string, entries: SkillProgressUpsertInput[]) => {
      if (!profileId) {
        throw new Error("A profile ID is required to save skill progress.");
      }

      const sanitizedEntries = (Array.isArray(entries) ? entries : [])
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map(entry => ({
          ...entry,
          profile_id: profileId
        }))
        .filter(entry => {
          const skillId = entry["skill_id"] ?? entry["skillId"];
          return typeof skillId === "string" || typeof skillId === "number";
        }) as Record<string, unknown>[];

      if (sanitizedEntries.length === 0) {
        if (Array.isArray(entries) && entries.length > 0) {
          console.warn("No valid skill progress entries provided for upsert.", entries);
        }
        return [];
      }

      try {
        const { data, error } = await supabase
          .from("profile_skill_progress")
          .upsert(sanitizedEntries, { onConflict: "profile_id,skill_id" })
          .select();

        if (error) {
          throw error;
        }

        const upsertedRows = ((data ?? sanitizedEntries) as SkillProgressRow[]) ?? [];

        setSkillProgress(prev =>
          mergeRowsBySkillId(
            (Array.isArray(prev) ? prev : []) as SkillProgressRow[],
            upsertedRows as SkillProgressRow[]
          )
        );

        return upsertedRows;
      } catch (err) {
        console.error("Failed to upsert skill progress:", err);
        const message =
          err && typeof err === "object" && "message" in err && typeof err.message === "string"
            ? err.message
            : "An unexpected error occurred while saving skill progress.";
        toast({
          title: "Failed to save skill progress",
          description: message,
          variant: "destructive"
        });
        throw err;
      }
    },
    []
  );

  const upsertSkillUnlocks = useCallback(
    async (profileId: string, entries: SkillUnlockUpsertInput[]) => {
      if (!profileId) {
        throw new Error("A profile ID is required to save skill unlocks.");
      }

      const sanitizedEntries = (Array.isArray(entries) ? entries : [])
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map(entry => ({
          ...entry,
          profile_id: profileId
        }))
        .filter(entry => {
          const skillId = entry["skill_id"] ?? entry["skillId"];
          return typeof skillId === "string" || typeof skillId === "number";
        }) as Record<string, unknown>[];

      if (sanitizedEntries.length === 0) {
        if (Array.isArray(entries) && entries.length > 0) {
          console.warn("No valid skill unlock entries provided for upsert.", entries);
        }
        return [];
      }

      try {
        const { data, error } = await supabase
          .from("profile_skill_unlocks")
          .upsert(sanitizedEntries, { onConflict: "profile_id,skill_id" })
          .select();

        if (error) {
          throw error;
        }

        const upsertedRows = ((data ?? sanitizedEntries) as SkillUnlockRow[]) ?? [];

        setSkillUnlockRows(prev =>
          mergeRowsBySkillId(
            (Array.isArray(prev) ? prev : []) as SkillUnlockRow[],
            upsertedRows as SkillUnlockRow[]
          )
        );

        return upsertedRows;
      } catch (err) {
        console.error("Failed to upsert skill unlocks:", err);
        const message =
          err && typeof err === "object" && "message" in err && typeof err.message === "string"
            ? err.message
            : "An unexpected error occurred while saving skill unlocks.";
        toast({
          title: "Failed to save skill unlocks",
          description: message,
          variant: "destructive"
        });
        throw err;
      }
    },
    []
  );

  const hasCharacters = useMemo(() => characters.length > 0, [characters]);
  const loading = useMemo(
    () => charactersLoading || dataLoading,
    [charactersLoading, dataLoading]
  );

  const unlockedSkills = useMemo(() => {
    const map: UnlockedSkillsMap = {};

    for (const row of skillUnlockRows) {
      if (!row) continue;

      const candidate = row as Record<string, unknown>;
      const slugCandidate =
        typeof candidate.skill_slug === "string" && candidate.skill_slug.length > 0
          ? candidate.skill_slug
          : candidate.skill_id;
      const resolvedSlug =
        typeof slugCandidate === "string"
          ? slugCandidate
          : typeof slugCandidate === "number"
            ? String(slugCandidate)
            : undefined;

      if (!resolvedSlug) {
        continue;
      }

      const unlockedValue = candidate.unlocked;
      map[resolvedSlug] = unlockedValue === undefined ? true : Boolean(unlockedValue);
    }

    return map;
  }, [skillUnlockRows]);

  return {
    characters,
    selectedCharacterId,
    profile,
    xpWallet,
    attributeStarTotal: Math.max(0, Number(xpWallet?.attribute_points_earned ?? 0)),
    freshWeeklyBonusAvailable,
    skillDefinitions,
    skillProgress,
    unlockedSkills,
    skills,
    attributes,
    activities,
    xpLedger,
    progressionCooldowns,
    currentCity,
    loading,
    error,
    hasCharacters,
    skillUnlocks: skillUnlockRows,
    setActiveCharacter,
    clearSelectedCharacter,
    updateProfile,
    updateSkills,
    updateAttributes,
    addActivity,
    applyProgressionUpdate,
    refreshProgressionState,
    acknowledgeWeeklyBonus,
    createCharacter,
    refreshCharacters,
    refetch,
    resetCharacter,
    upsertSkillProgress,
    upsertSkillUnlocks
  };
};

export const GameDataProvider = ({ children }: { children: ReactNode }) => {
  const value = useProvideGameData();
  return <GameDataContext.Provider value={value}>{children}</GameDataContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useGameData = (): GameDataContextValue => {
  const context = useContext(GameDataContext);
  if (!context) {
    return defaultGameDataContext;
  }

  return context;
};
