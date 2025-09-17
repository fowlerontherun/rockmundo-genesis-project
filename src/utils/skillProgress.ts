import type { PlayerSkills } from "@/hooks/useGameData";

export const SKILL_KEYS = [
  "guitar",
  "bass",
  "drums",
  "vocals",
  "performance",
  "songwriting"
] as const;

export type SkillKey = (typeof SKILL_KEYS)[number];

const SKILL_KEY_SET = new Set<string>(SKILL_KEYS);

type UnknownRecord = Record<string, unknown>;

export interface SkillProgressEntry extends UnknownRecord {
  skill?: string | null;
  slug?: string | null;
  key?: string | null;
  name?: string | null;
  skill_key?: string | null;
  skillKey?: string | null;
  current_level?: number | null;
  currentLevel?: number | null;
  level?: number | null;
  value?: number | null;
  level_value?: number | null;
  levelValue?: number | null;
  locked?: boolean | null;
  is_locked?: boolean | null;
  isLocked?: boolean | null;
  unlocked?: boolean | null;
  status?: string | null;
}

export type SkillProgressLike = SkillProgressEntry | number | null | undefined;

export type SkillProgressMap = Map<string, SkillProgressEntry>;

export type SkillProgressSource =
  | SkillProgressMap
  | Iterable<[string, SkillProgressLike]>
  | SkillProgressEntry[]
  | Record<string, SkillProgressLike>
  | PlayerSkills
  | null
  | undefined;

export type SkillLevelRecord = Record<SkillKey, number>;

const normalizeKey = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return null;
  return normalized;
};

const pickSkillKey = (entry: SkillProgressEntry): SkillKey | null => {
  const candidates = [
    entry.skill,
    entry.slug,
    entry.key,
    entry.skill_key,
    entry.skillKey,
    entry.name
  ];

  for (const candidate of candidates) {
    const normalized = normalizeKey(candidate);
    if (normalized && SKILL_KEY_SET.has(normalized)) {
      return normalized as SkillKey;
    }
  }

  return null;
};

const coerceEntry = (value: SkillProgressLike): SkillProgressEntry | null => {
  if (value == null) return null;
  if (typeof value === "number") {
    return { current_level: value } satisfies SkillProgressEntry;
  }
  if (typeof value === "object") {
    return value as SkillProgressEntry;
  }
  return null;
};

const mapFromRecord = (record: Record<string, SkillProgressLike>): SkillProgressMap => {
  const entries: [string, SkillProgressEntry][] = [];

  for (const [key, rawValue] of Object.entries(record)) {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey || !SKILL_KEY_SET.has(normalizedKey)) continue;

    const coerced = coerceEntry(rawValue);
    if (!coerced) continue;

    entries.push([normalizedKey, coerced]);
  }

  return new Map(entries);
};

const mapFromArray = (values: SkillProgressEntry[]): SkillProgressMap => {
  const entries: [string, SkillProgressEntry][] = [];

  for (const entry of values) {
    if (!entry || typeof entry !== "object") continue;
    const key = pickSkillKey(entry);
    if (!key) continue;
    entries.push([key, entry]);
  }

  return new Map(entries);
};

const mapFromPlayerSkills = (skills: PlayerSkills): SkillProgressMap => {
  const entries = SKILL_KEYS.map((key) => [key, { current_level: skills[key] ?? 0 }] as const);
  return new Map(entries);
};

export const toSkillProgressMap = (
  source: SkillProgressSource,
  fallback?: PlayerSkills | null
): SkillProgressMap => {
  if (source instanceof Map) {
    const normalizedEntries: [string, SkillProgressEntry][] = [];
    source.forEach((value, key) => {
      const normalizedKey = normalizeKey(key);
      if (!normalizedKey || !SKILL_KEY_SET.has(normalizedKey)) return;
      const coerced = coerceEntry(value);
      if (!coerced) return;
      normalizedEntries.push([normalizedKey, coerced]);
    });
    if (normalizedEntries.length > 0) {
      return new Map(normalizedEntries);
    }
  }

  if (Array.isArray(source)) {
    if (source.length > 0 && Array.isArray(source[0]) && source[0]?.length === 2) {
      const iterable = new Map(source as Iterable<[string, SkillProgressLike]>);
      return toSkillProgressMap(iterable, fallback);
    }

    const arrayMap = mapFromArray(source as SkillProgressEntry[]);
    if (arrayMap.size > 0) {
      return arrayMap;
    }
  }

  if (source && typeof source === "object") {
    if ("entries" in source && typeof (source as Iterable<unknown>)[Symbol.iterator] === "function") {
      const iterable = Array.from(source as Iterable<[string, SkillProgressLike]>);
      return toSkillProgressMap(iterable, fallback);
    }

    const recordMap = mapFromRecord(source as Record<string, SkillProgressLike>);
    if (recordMap.size > 0) {
      return recordMap;
    }
  }

  if (fallback) {
    return mapFromPlayerSkills(fallback);
  }

  return new Map();
};

const resolveNumericValue = (entry: SkillProgressEntry | undefined): number | null => {
  if (!entry) return null;

  const candidates = [
    entry.current_level,
    entry.currentLevel,
    entry.level,
    entry.value,
    entry.level_value,
    entry.levelValue
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return null;
};

const isEntryLocked = (entry: SkillProgressEntry | undefined): boolean => {
  if (!entry) return false;

  const candidates = [
    entry.locked,
    entry.is_locked,
    entry.isLocked,
    typeof entry.unlocked === "boolean" ? !entry.unlocked : undefined,
    entry.status === "locked" ? true : undefined
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "boolean") {
      return candidate;
    }
  }

  return false;
};

export const getSkillLevel = (
  progressMap: SkillProgressMap,
  skill: SkillKey,
  fallback?: PlayerSkills | null
): number => {
  const entry = progressMap.get(skill);
  if (entry) {
    if (isEntryLocked(entry)) {
      return 0;
    }

    const resolved = resolveNumericValue(entry);
    if (typeof resolved === "number") {
      return resolved;
    }
  }

  const fallbackValue = fallback?.[skill];
  return typeof fallbackValue === "number" ? fallbackValue : 0;
};

interface AverageOptions {
  ignoreLocked?: boolean;
}

export const calculateAverageSkillLevel = (
  progressMap: SkillProgressMap,
  skillKeys: SkillKey[],
  fallback?: PlayerSkills | null,
  options?: AverageOptions
): number => {
  let total = 0;
  let count = 0;

  for (const skill of skillKeys) {
    const entry = progressMap.get(skill);
    const locked = isEntryLocked(entry);

    if (locked && options?.ignoreLocked) {
      continue;
    }

    if (locked) {
      count += 1;
      continue;
    }

    total += getSkillLevel(progressMap, skill, fallback);
    count += 1;
  }

  if (count === 0) return 0;
  return total / count;
};

export const buildSkillLevelRecord = (
  progressMap: SkillProgressMap,
  fallback?: PlayerSkills | null
): SkillLevelRecord => {
  return SKILL_KEYS.reduce((acc, key) => {
    acc[key] = getSkillLevel(progressMap, key, fallback);
    return acc;
  }, {} as SkillLevelRecord);
};

export const hasSkillData = (
  progressMap: SkillProgressMap,
  fallback?: PlayerSkills | null
): boolean => {
  if (progressMap.size > 0) {
    return true;
  }

  if (!fallback) {
    return false;
  }

  return SKILL_KEYS.some((key) => typeof fallback[key] === "number");
};

export const isSkillLocked = (
  progressMap: SkillProgressMap,
  skill: SkillKey
): boolean => {
  const entry = progressMap.get(skill);
  return isEntryLocked(entry);
};
