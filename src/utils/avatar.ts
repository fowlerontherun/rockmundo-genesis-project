import type { AvatarSelection } from "@/data/avatarPresets";

const AVATAR_DATA_TYPE = "rockmundo.avatar" as const;

export type StoredAvatarData = {
  type: typeof AVATAR_DATA_TYPE;
  version: 1;
  previewUrl: string | null;
  config: AvatarSelection;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const serializeAvatarData = (
  selection: AvatarSelection,
  previewUrl?: string | null,
): string => {
  const payload: StoredAvatarData = {
    type: AVATAR_DATA_TYPE,
    version: 1,
    previewUrl: previewUrl ?? null,
    config: selection,
  };

  return JSON.stringify(payload);
};

export const parseAvatarData = (value: string | null | undefined): StoredAvatarData | null => {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    if (parsed.type !== AVATAR_DATA_TYPE || parsed.version !== 1) {
      return null;
    }

    if (!isRecord(parsed.config)) {
      return null;
    }

    const { styleId, poseId, cameraId } = parsed.config as Record<string, unknown>;

    if (
      typeof styleId !== "string" ||
      typeof poseId !== "string" ||
      typeof cameraId !== "string"
    ) {
      return null;
    }

    return {
      type: AVATAR_DATA_TYPE,
      version: 1,
      previewUrl: typeof parsed.previewUrl === "string" ? parsed.previewUrl : null,
      config: {
        styleId,
        poseId,
        cameraId,
      },
    };
  } catch (error) {
    console.warn("Failed to parse stored avatar data", error);
    return null;
  }
};

export const getStoredAvatarPreviewUrl = (
  value: string | null | undefined,
): string | null => {
  const stored = parseAvatarData(value);
  if (stored) {
    return stored.previewUrl;
  }

  return typeof value === "string" && value.length > 0 ? value : null;
};

export const getStoredAvatarSelection = (
  value: string | null | undefined,
  fallback?: AvatarSelection,
): AvatarSelection | null => {
  const stored = parseAvatarData(value);
  if (stored) {
    return stored.config;
  }

  return fallback ?? null;
};

export const isStoredAvatarValue = (value: string | null | undefined): boolean => {
  return parseAvatarData(value) !== null;
};
