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

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import type { Tables } from "@/integrations/supabase/types";
import { sortByOptionalKeys } from "@/utils/sorting";
import {
  awardActionXp as invokeAwardActionXp,
  buyAttributeStar as invokeBuyAttributeStar,
  isProgressionSuccessResponse,
  type AwardActionXpInput,
  type BuyAttributeStarInput,
  type ProgressionSuccessResponse
} from "@/utils/progressionClient";
import type {
  PostgrestError,
  PostgrestMaybeSingleResponse,
  PostgrestResponse
} from "@supabase/supabase-js";

export type PlayerProfile = Tables<"profiles">;
export type PlayerSkills = Tables<"player_skills">;
export type PlayerAttributes = Tables<"player_attributes">;
export type ActivityItem = Tables<"activity_feed">;
export type ExperienceLedgerEntry = Tables<"experience_ledger">;
export type PlayerXpWallet = Tables<"player_xp_wallet">;
// Temporary type definitions until database schema is updated
type AttributeDefinition = any;
type ProfileAttribute = any;

// Temporary type definitions until proper types are available
export type SkillDefinition = any;
export type SkillProgressRow = any;
export type SkillUnlockRow = any;
type UnlockedSkillsMap = Record<string, boolean>;
type AttributesMap = Record<string, number>;
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
  latestEntry: ExperienceLedgerEntry | undefined,
  now: Date = new Date()
) => {
  const recordedAt = toValidDate(latestEntry?.recorded_at ?? null);
  return (recordedAt ?? now).toISOString();
};

export const evaluateWeeklyBonusState = (
  latestEntry: ExperienceLedgerEntry | undefined,
  storedAcknowledgement: string | null,
  now: Date = new Date()
): WeeklyBonusEvaluationResult => {
  if (!latestEntry) {
    return {
      freshWeeklyBonusAvailable: false,
      acknowledgementToPersist: storedAcknowledgement ? undefined : null
    };
  }

  const recordedAt = toValidDate(latestEntry.recorded_at);
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

const isMissingTableError = (error: PostgrestError | null | undefined) =>
  Boolean(
    error?.code === "42P01" ||
      error?.code === "PGRST201" ||
      error?.message?.toLowerCase().includes("does not exist")
  );

const omitFromRecord = <T extends Record<string, unknown>>(source: T, key: string) => {
  if (!(key in source)) {
    return source;
  }

  const { [key]: _omitted, ...rest } = source;
  return rest as T;
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
  freshWeeklyBonusAvailable: boolean;
  skillDefinitions: SkillDefinition[];
  skillProgress: SkillProgressRow[];
  unlockedSkills: UnlockedSkillsMap;
  skills: PlayerSkills | null;
  attributes: AttributesMap;
  xpWallet: PlayerXpWallet | null;
  progressionCooldowns: Record<string, number>;
  activities: ActivityItem[];
  experienceLedger: ExperienceLedgerEntry[];
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
    earnings?: number
  ) => Promise<ActivityItem | undefined>;
  awardActionXp: (input: AwardActionXpInput) => Promise<ProgressionSuccessResponse>;
  buyAttributeStar: (input: BuyAttributeStarInput) => Promise<ProgressionSuccessResponse>;
  refreshProgressionState: () => Promise<void>;
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

const defaultGameDataContext: GameDataContextValue = {
  characters: [],
  selectedCharacterId: null,
  profile: null,
  freshWeeklyBonusAvailable: false,
  skillDefinitions: [],
  skillProgress: [],
  unlockedSkills: {},
  skills: null,
  attributes: {},
  xpWallet: null,
  progressionCooldowns: {},
  activities: [],
  experienceLedger: [],
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
    return undefined;
  },
  awardActionXp: async () => {
    warnMissingProvider();
    throw new Error(missingProviderMessage);
  },
  buyAttributeStar: async () => {
    warnMissingProvider();
    throw new Error(missingProviderMessage);
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
  }
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
  const [attributes, setAttributes] = useState<any>({});
  const [xpWallet, setXpWallet] = useState<PlayerXpWallet | null>(null);
  const [progressionCooldowns, setProgressionCooldowns] = useState<Record<string, number>>({});
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [experienceLedger, setExperienceLedger] = useState<ExperienceLedgerEntry[]>([]);
  const [currentCity, setCurrentCity] = useState<Tables<"cities"> | null>(null);
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshWeeklyBonusAvailable, setFreshWeeklyBonusAvailable] = useState(false);
  const supportsProfileScopedDataRef = useRef<boolean | null>(null);
  const clearGameState = useCallback(() => {
    setProfile(null);
    setSkills(null);
    setAttributes(null);
    setXpWallet(null);
    setProgressionCooldowns({});
    setActivities([]);
    setExperienceLedger([]);
    setCurrentCity(null);
    setFreshWeeklyBonusAvailable(false);
  }, []);

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
      await resolveCurrentCity(character.current_city_id ?? null);

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
          mental_focus: resolvedAttributes["mental_focus"] ?? 0,
          physical_endurance: resolvedAttributes["physical_endurance"] ?? 0
        };

        const initialAttributePayload =
          supportsProfileScopedDataRef.current === false
            ? omitFromRecord(baseAttributePayload, "profile_id")
            : baseAttributePayload;

        const insertedAttributes = await supabase
          .from("player_attributes")
          .insert(initialAttributePayload)
          .select()
          .single();

        if (insertedAttributes.error) {
          if (isMissingColumnError(insertedAttributes.error, "profile_id")) {
            supportsProfileScopedDataRef.current = false;
            const fallbackInsert = await supabase
              .from("player_attributes")
              .insert(omitFromRecord(baseAttributePayload, "profile_id"))
              .select()
              .single();

            if (fallbackInsert.error) {
              throw fallbackInsert.error;
            }

            attributesData = fallbackInsert.data;
          } else {
            throw insertedAttributes.error;
          }
        } else {
          attributesData = insertedAttributes.data;
        }
      }

      setAttributes(attributesData ?? {});

      let walletData: PlayerXpWallet | null = null;
      const walletResponse = await supabase
        .from("player_xp_wallet")
        .select("*")
        .eq("profile_id", selectedCharacterId)
        .maybeSingle();

      if (walletResponse.error) {
        if (
          walletResponse.status === 404 ||
          walletResponse.status === 406 ||
          isMissingTableError(walletResponse.error)
        ) {
          walletData = null;
        } else {
          throw walletResponse.error;
        }
      } else {
        walletData = (walletResponse.data as PlayerXpWallet | null) ?? null;
      }

      setXpWallet(walletData);

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

      let ledgerData: ExperienceLedgerEntry[] = [];
      let ledgerResponse = await supabase
        .from("experience_ledger")
        .select("*")
        .eq("profile_id", selectedCharacterId)
        .order("recorded_at", { ascending: false })
        .limit(20);

      if (ledgerResponse.error) {
        if (isMissingTableError(ledgerResponse.error)) {
          ledgerData = [];
        } else if (isMissingColumnError(ledgerResponse.error, "profile_id")) {
          ledgerResponse = await supabase
            .from("experience_ledger")
            .select("*")
            .eq("user_id", character.user_id)
            .order("recorded_at", { ascending: false })
            .limit(20);

          if (ledgerResponse.error) {
            throw ledgerResponse.error;
          }

          ledgerData = (ledgerResponse.data ?? []) as ExperienceLedgerEntry[];
        } else {
          throw ledgerResponse.error;
        }
      } else {
        ledgerData = (ledgerResponse.data ?? []) as ExperienceLedgerEntry[];
      }

      setExperienceLedger(ledgerData);

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
    resolveCurrentCity
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

    const latestWeeklyBonus = experienceLedger.find(
      entry => entry.reason === WEEKLY_BONUS_REASON
    );
    const acknowledgementTimestamp = resolveWeeklyBonusAcknowledgementTimestamp(latestWeeklyBonus);
    writeWeeklyBonusAcknowledgement(profile.id, acknowledgementTimestamp);
    setFreshWeeklyBonusAvailable(false);
  }, [experienceLedger, profile]);

  const applyProgressionState = useCallback(
    (response: ProgressionSuccessResponse | null | undefined) => {
      if (!response) {
        return;
      }

      if (response.cooldowns) {
        setProgressionCooldowns(response.cooldowns);
      }

      if (response.wallet !== undefined) {
        setXpWallet(response.wallet ?? null);
      }

      if (response.attributes) {
        setAttributes(response.attributes);
      }

      if (response.profile) {
        setProfile(previous => {
          if (!previous) {
            return previous;
          }

          const patch: Partial<PlayerProfile> & Record<string, unknown> = {
            experience: response.profile.experience,
            level: response.profile.level,
            updated_at: response.profile.updated_at
          };

          if (typeof response.profile.display_name !== "undefined") {
            patch.display_name = response.profile.display_name;
          }

          if (typeof response.profile.username === "string") {
            patch.username = response.profile.username;
          }

          if (typeof response.profile.attribute_points_available === "number") {
            patch.attribute_points_available = response.profile.attribute_points_available;
          }

          if (typeof response.profile.skill_points_available === "number") {
            patch.skill_points_available = response.profile.skill_points_available;
          }

          return { ...previous, ...patch } as PlayerProfile;
        });
      }
    },
    [setAttributes, setProfile, setProgressionCooldowns, setXpWallet]
  );

  const awardActionXp = useCallback(
    async (input: AwardActionXpInput) => {
      const response = await invokeAwardActionXp(input);
      if (!isProgressionSuccessResponse(response)) {
        throw new Error(response.message ?? "Failed to award action XP.");
      }

      applyProgressionState(response);
      return response;
    },
    [applyProgressionState]
  );

  const buyAttributeStar = useCallback(
    async (input: BuyAttributeStarInput) => {
      const response = await invokeBuyAttributeStar(input);
      if (!isProgressionSuccessResponse(response)) {
        throw new Error(response.message ?? "Failed to purchase attribute upgrade.");
      }

      applyProgressionState(response);
      return response;
    },
    [applyProgressionState]
  );

  const refreshProgressionState = useCallback(() => fetchGameData(), [fetchGameData]);

  useEffect(() => {
    if (!profile?.id) {
      setFreshWeeklyBonusAvailable(false);
      return;
    }

    const latestWeeklyBonus = experienceLedger.find(
      entry => entry.reason === WEEKLY_BONUS_REASON
    );
    const acknowledgement = readWeeklyBonusAcknowledgement(profile.id);
    const { freshWeeklyBonusAvailable: hasFreshBonus, acknowledgementToPersist } =
      evaluateWeeklyBonusState(latestWeeklyBonus, acknowledgement);

    setFreshWeeklyBonusAvailable(hasFreshBonus);

    if (acknowledgementToPersist !== undefined) {
      writeWeeklyBonusAcknowledgement(profile.id, acknowledgementToPersist);
    }
  }, [experienceLedger, profile]);

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

  const updateProfile = useCallback(
    async (updates: Partial<PlayerProfile>) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      const basePayload = {
        ...updates,
        updated_at: updates.updated_at ?? new Date().toISOString()
      };

      let attemptedPayload: Record<string, unknown> = { ...basePayload };
      const skippedColumns = new Set<string>();

      while (Object.keys(attemptedPayload).length > 0) {
        const response = await supabase
          .from("profiles")
          .update(attemptedPayload)
          .eq("id", selectedCharacterId)
          .select()
          .maybeSingle();

        if (!response.error) {
          const appliedPayload = attemptedPayload as Partial<PlayerProfile>;
          const nextProfile = response.data ?? (profile ? { ...profile, ...appliedPayload } : null);
          setProfile(nextProfile);
          return nextProfile ?? undefined;
        }

        const missingColumn = extractMissingColumn(response.error);
        if (
          missingColumn &&
          !skippedColumns.has(missingColumn) &&
          missingColumn in attemptedPayload
        ) {
          skippedColumns.add(missingColumn);
          attemptedPayload = omitFromRecord(attemptedPayload, missingColumn);
          continue;
        }

        console.error("Error updating profile:", response.error);
        throw response.error;
      }

      return profile ?? undefined;
    },
    [profile, selectedCharacterId, user]
  );

  const updateSkills = useCallback(
    async (updates: Partial<PlayerSkills>) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      const payload = {
        ...updates,
        updated_at: updates.updated_at ?? new Date().toISOString()
      };

      const primaryColumn = supportsProfileScopedDataRef.current === false ? "user_id" : "profile_id";
      const primaryValue = primaryColumn === "user_id" ? user.id : selectedCharacterId;

      let updateResponse = await supabase
        .from("player_skills")
        .update(payload)
        .eq(primaryColumn, primaryValue)
        .select()
        .maybeSingle();

      if (updateResponse.error) {
        if (
          primaryColumn === "profile_id" &&
          isMissingColumnError(updateResponse.error, "profile_id")
        ) {
          supportsProfileScopedDataRef.current = false;
          updateResponse = await supabase
            .from("player_skills")
            .update(payload)
            .eq("user_id", user.id)
            .select()
            .maybeSingle();
        } else {
          console.error("Error updating skills:", updateResponse.error);
          throw updateResponse.error;
        }
      } else if (primaryColumn === "profile_id") {
        supportsProfileScopedDataRef.current = true;
      }

      const nextSkills = updateResponse.data ?? (skills ? { ...skills, ...payload } : null);
      setSkills(nextSkills);
      return nextSkills ?? undefined;
    },
    [selectedCharacterId, skills, user]
  );

  const updateAttributes = useCallback(
    async (updates: Partial<PlayerAttributes>) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      const payload = {
        ...updates,
        updated_at: updates.updated_at ?? new Date().toISOString()
      };

      try {
        const primaryColumn = supportsProfileScopedDataRef.current === false ? "user_id" : "profile_id";
        const primaryValue = primaryColumn === "user_id" ? user.id : selectedCharacterId;

        let updateResponse = await supabase
          .from("player_attributes")
          .update(payload)
          .eq(primaryColumn, primaryValue)
          .select()
          .maybeSingle();

        if (updateResponse.error) {
          if (
            primaryColumn === "profile_id" &&
            isMissingColumnError(updateResponse.error, "profile_id")
          ) {
            supportsProfileScopedDataRef.current = false;
            updateResponse = await supabase
              .from("player_attributes")
              .update(payload)
              .eq("user_id", user.id)
              .select()
              .maybeSingle();
          } else {
            throw updateResponse.error;
          }
        } else if (primaryColumn === "profile_id") {
          supportsProfileScopedDataRef.current = true;
        }

        const nextAttributes = updateResponse.data ?? (attributes ? { ...attributes, ...payload } : null);
        setAttributes(nextAttributes);
        return nextAttributes;
      } catch (updateError) {
        console.error("Error updating attributes:", updateError);
        throw updateError;
      }
    },
    [attributes, selectedCharacterId, user]
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

  const upsertSkillProgress = useCallback(async (profileId: string, entries: SkillProgressUpsertInput[]) => {
    return [];
  }, []);

  const upsertSkillUnlocks = useCallback(async (profileId: string, entries: SkillUnlockUpsertInput[]) => {
    return [];
  }, []);

  const hasCharacters = useMemo(() => characters.length > 0, [characters]);
  const loading = useMemo(
    () => charactersLoading || dataLoading,
    [charactersLoading, dataLoading]
  );

  // Add missing functions and variables that are referenced
  const unlockedSkills = {};

  return {
    characters,
    selectedCharacterId,
    profile,
    freshWeeklyBonusAvailable,
    skillDefinitions,
    skillProgress,
    unlockedSkills,
    skills,
    attributes,
    xpWallet,
    progressionCooldowns,
    activities,
    experienceLedger,
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
    awardActionXp,
    buyAttributeStar,
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
