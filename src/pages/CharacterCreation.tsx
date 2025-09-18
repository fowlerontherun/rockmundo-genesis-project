import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  SparklesIcon,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Palette,
  Gauge,
  User,
  Move3d,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AvatarPreview3D from "@/components/avatar/AvatarPreview3D";
import {
  avatarStyles,
  avatarPoses,
  avatarCameras,
  defaultAvatarSelection,
} from "@/data/avatarPresets";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData, type PlayerProfile } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import { ensureDefaultWardrobe, parseClothingLoadout } from "@/utils/wardrobe";
import type { Database, Tables, TablesInsert } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";
import { useToast } from "@/components/ui/use-toast";
import { generateRandomName, generateHandleFromName } from "@/utils/nameGenerator";
import { getStoredAvatarSelection, serializeAvatarData } from "@/utils/avatar";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_METADATA,
  ATTRIBUTE_MAX_VALUE,
  type AttributeKey,
} from "@/utils/attributeProgression";

const backgrounds = [
  {
    id: "street",
    label: "Street Performer",
    description:
      "You honed your sound battling city noise and turning sidewalks into stages.",
  },
  {
    id: "classical",
    label: "Classically Trained",
    description:
      "Years of formal training forged your technique—now you bend the rules to your will.",
  },
  {
    id: "producer",
    label: "Bedroom Producer",
    description:
      "From humble bedroom studios, you sculpted sounds that resonate across the world.",
  },
  {
    id: "wildcard",
    label: "Wildcard", 
    description:
      "A mystery wrapped in feedback and stage fog. Your story is still being written.",
  },
];

const MIN_ATTRIBUTE_VALUE = 0;
const MAX_ATTRIBUTE_VALUE = ATTRIBUTE_MAX_VALUE;

const extractMissingColumn = (error: PostgrestError | null | undefined) => {
  if (!error) {
    return null;
  }

  const haystacks = [error.message, error.details, error.hint].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  const patterns = [
    /column\s+(?:"?[\w]+"?\.)?"?([\w]+)"?\s+does not exist/i,
    /'([\w]+)'\s+column/i,
  ];

  for (const haystack of haystacks) {
    for (const pattern of patterns) {
      const match = haystack.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
  }

  if (error.code === "PGRST204") {
    // PostgREST may return this error before its schema cache refreshes.
    const fallbackMatch = error.message?.match(/'([\w]+)'/);
    if (fallbackMatch?.[1]) {
      return fallbackMatch[1];
    }
  }

  return null;
};

const isPostgrestError = (error: unknown): error is PostgrestError => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Partial<PostgrestError>;
  return typeof candidate.code === "string" && typeof candidate.message === "string";
};

const buildSaveErrorMessage = (error: unknown) => {
  if (isPostgrestError(error)) {
    const parts = [error.message, error.details, error.hint].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "An unknown error occurred while saving your character.";
};

const sanitizePayloadForLogging = (
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined => {
  if (!payload) {
    return payload ?? null;
  }

  const sanitized: Record<string, unknown> = { ...payload };

  if ("avatar_url" in sanitized) {
    sanitized.avatar_url = "[omitted]";
  }

  if ("bio" in sanitized && typeof sanitized.bio === "string") {
    const bio = sanitized.bio as string;
    sanitized.bio = bio.length > 120 ? `${bio.slice(0, 117)}...` : bio;
  }

  return sanitized;
};
const ensureNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const extractConstraintName = (error: PostgrestError): string | null => {
  const haystacks = [error.message, error.details, error.hint].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  for (const haystack of haystacks) {
    const match = haystack.match(/constraint\s+"([^"]+)"/i);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
};

const extractDuplicateKeyDetail = (
  source: string | null | undefined,
): { field: string; value: string } | null => {
  if (!source) {
    return null;
  }

  const match = source.match(/Key \(([^)]+)\)=\(([^)]+)\) already exists\.?/i);
  if (match?.[1] && match?.[2]) {
    return { field: match[1], value: match[2] };
  }

  return null;
};

type SaveFailureStage =
  | "profile-upsert"
  | "ensure-wardrobe"
  | "attribute-upsert"
  | "refresh-characters"
  | "activate-character"
  | "unknown";

const SAVE_ERROR_STAGE_LABELS: Record<SaveFailureStage, string> = {
  "profile-upsert": "Saving your profile details",
  "ensure-wardrobe": "Ensuring your wardrobe is initialized",
  "attribute-upsert": "Saving your attribute distribution",
  "refresh-characters": "Refreshing your character list",
  "activate-character": "Activating your saved character",
  unknown: "Completing the character save",
};

type SaveErrorState = {
  message: string;
  stage: SaveFailureStage;
  code?: string;
  details?: string;
  hint?: string;
  friendlyMessage?: string;
  duplicateField?: string;
  duplicateValue?: string;
  constraint?: string;
  profilePayload?: Record<string, unknown> | null;
  attributesPayload?: Record<string, unknown> | null;
};

const getFriendlySaveErrorMessage = (
  error: unknown,
  stage: SaveFailureStage,
  duplicateDetail?: { field: string; value: string } | null,
  constraint?: string | null,
): string | null => {
  if (isPostgrestError(error)) {
    if (error.code === "23505") {
      if (duplicateDetail?.field === "username") {
        return `The artist handle "${duplicateDetail.value}" is already taken. Try a different handle.`;
      }

      if (duplicateDetail?.field === "display_name") {
        return `The stage name "${duplicateDetail.value}" is already in use. Pick something more unique.`;
      }

      if (duplicateDetail) {
        return `Another record already uses the ${duplicateDetail.field} value "${duplicateDetail.value}". Try updating that value.`;
      }

      if (constraint) {
        return `This save conflicts with the constraint "${constraint}". Try changing any values that must be unique.`;
      }

      return "One of the values you entered must be unique. Try choosing different details.";
    }

    if (error.code === "23503") {
      return "We couldn't link this save to the related records it expects. Refresh the page and try again.";
    }

    if (error.code === "42501" || /row-level security/i.test(error.message)) {
      return "Your account doesn't have permission to save this character. Make sure you're logged in with the right profile.";
    }

    if (error.code === "22P02") {
      return "One of the values sent to the server had the wrong format. Double-check any numbers or selections and try again.";
    }

    if (error.code === "42703") {
      return "The server rejected one of the fields we sent. Refresh the page to make sure you have the latest form.";
    }
  }

  if (error instanceof Error) {
    if (/did not return any data/i.test(error.message)) {
      return "The server didn't confirm the save. Please try again in a moment.";
    }
  }

  if (stage === "ensure-wardrobe") {
    return "We couldn't prepare your wardrobe after saving. Try again so we can finish setting up your look.";
  }

  return null;
};

const buildSaveErrorState = (
  error: unknown,
  stage: SaveFailureStage,
  attemptedProfilePayload: Record<string, unknown> | null | undefined,
  attemptedAttributesPayload: Record<string, unknown> | null | undefined,
): SaveErrorState => {
  const sanitizedProfilePayload = sanitizePayloadForLogging(attemptedProfilePayload) ?? null;
  const sanitizedAttributesPayload = sanitizePayloadForLogging(attemptedAttributesPayload) ?? null;

  const baseState: SaveErrorState = {
    message: buildSaveErrorMessage(error),
    stage,
    profilePayload: sanitizedProfilePayload,
    attributesPayload: sanitizedAttributesPayload,
  };

  if (isPostgrestError(error)) {
    const code = ensureNonEmptyString(error.code);
    if (code) {
      baseState.code = code;
    }

    const details = ensureNonEmptyString(error.details);
    if (details) {
      baseState.details = details;
    }

    const hint = ensureNonEmptyString(error.hint);
    if (hint) {
      baseState.hint = hint;
    }

    const duplicateDetail =
      extractDuplicateKeyDetail(details) || extractDuplicateKeyDetail(error.message);
    if (duplicateDetail) {
      baseState.duplicateField = duplicateDetail.field;
      baseState.duplicateValue = duplicateDetail.value;
    }

    const constraint = extractConstraintName(error);
    if (constraint) {
      baseState.constraint = constraint;
    }

    const friendlyMessage = getFriendlySaveErrorMessage(error, stage, duplicateDetail, constraint);
    if (friendlyMessage) {
      baseState.friendlyMessage = friendlyMessage;
    }

    return baseState;
  }

  const friendlyMessage = getFriendlySaveErrorMessage(error, stage);
  if (friendlyMessage) {
    baseState.friendlyMessage = friendlyMessage;
  }

  return baseState;
};

const omitFromRecord = <T extends Record<string, unknown>>(source: T, key: string) => {
  if (!(key in source)) {
    return source;
  }

  const { [key]: _omitted, ...rest } = source;
  return rest as T;
};

const extractNumericField = (source: unknown, key: string): number | null => {
  if (!source || typeof source !== "object") {
    return null;
  }

  const value = (source as Record<string, unknown>)[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
};

const formatDisplayName = (slug: string): string =>
  slug
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const coerceNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const buildAttributeStateFromRecord = (
  record: Record<string, unknown> | null | undefined,
  keys: AttributeKey[],
  previousState?: Record<AttributeKey, number>,
): Record<AttributeKey, number> => {
  const next = {} as Record<AttributeKey, number>;
  const source = record ?? {};

  keys.forEach((key) => {
    const directValue = coerceNumber((source as Record<string, unknown>)[key]);

    if (typeof directValue === "number") {
      next[key] = normalizeAttributeValue(directValue);
      return;
    }

    if (previousState && typeof previousState[key] === "number") {
      next[key] = normalizeAttributeValue(previousState[key]);
      return;
    }

    next[key] = MIN_ATTRIBUTE_VALUE;
  });

  return next;
};

const normalizeAttributeValue = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(MIN_ATTRIBUTE_VALUE, Math.min(MAX_ATTRIBUTE_VALUE, Math.round(value)));
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return MIN_ATTRIBUTE_VALUE;
  }

  return Math.max(MIN_ATTRIBUTE_VALUE, Math.min(MAX_ATTRIBUTE_VALUE, Math.round(numeric)));
};

type ProfileRow = Tables<"profiles">;

type ProfileInsert = TablesInsert<"profiles">;
type PlayerAttributesRow = Tables<"player_attributes">;
type PlayerAttributesInsert = TablesInsert<"player_attributes">;

type ProfileGender = Database["public"]["Enums"]["profile_gender"];

type CityOption = {
  id: string;
  name: string | null;
  country: string | null;
};

type CharacterCreationLocationState = {
  fromProfile?: boolean;
  profileId?: string | null;
};

const genderOptions: { value: ProfileGender; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const NO_CITY_SELECTED_VALUE = "__no_city_selected__";

const sanitizeHandle = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const CharacterCreation = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const {
    refreshCharacters,
    setActiveCharacter,
    selectedCharacterId,
    profile: activeProfile,
  } = useGameData();

  const locationState = location.state as CharacterCreationLocationState | null;
  const fromProfileFlow = Boolean(locationState?.fromProfile);
  const locationProfileId =
    typeof locationState?.profileId === "string" && locationState.profileId.length > 0
      ? locationState.profileId
      : null;
  const activeProfileId = activeProfile?.id ?? null;
  const targetProfileId = useMemo(() => {
    return locationProfileId ?? selectedCharacterId ?? activeProfileId ?? null;
  }, [locationProfileId, selectedCharacterId, activeProfileId]);

  const [nameSuggestion, setNameSuggestion] = useState<string>(() => generateRandomName());
  const [displayName, setDisplayName] = useState<string>(nameSuggestion);
  const [username, setUsername] = useState<string>(() => {
    const base = sanitizeHandle(nameSuggestion);
    return base || generateHandleFromName(nameSuggestion);
  });
  const [usernameEdited, setUsernameEdited] = useState<boolean>(false);
  const [bio, setBio] = useState<string>(backgrounds[0].description);
  const [selectedBackground, setSelectedBackground] = useState<string>(backgrounds[0].id);
  const [selectedAvatarStyle, setSelectedAvatarStyle] = useState<string>(
    defaultAvatarSelection.styleId,
  );
  const [selectedAvatarPose, setSelectedAvatarPose] = useState<string>(defaultAvatarSelection.poseId);
  const [selectedAvatarCamera, setSelectedAvatarCamera] = useState<string>(
    defaultAvatarSelection.cameraId,
  );
  const [attributes, setAttributes] = useState<Record<AttributeKey, number>>(() =>
    ATTRIBUTE_KEYS.reduce<Record<AttributeKey, number>>((accumulator, key) => {
      accumulator[key] = MIN_ATTRIBUTE_VALUE;
      return accumulator;
    }, {} as Record<AttributeKey, number>),
  );
  const [existingAttributes, setExistingAttributes] = useState<PlayerAttributesRow | null>(null);
  const [existingProfile, setExistingProfile] = useState<ProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<SaveErrorState | null>(null);

  const [gender, setGender] = useState<ProfileGender>("prefer_not_to_say");
  const [age, setAge] = useState<string>("16");
  const [cityOfBirth, setCityOfBirth] = useState<string | null>(null);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [citiesLoading, setCitiesLoading] = useState<boolean>(false);
  const [citiesError, setCitiesError] = useState<string | null>(null);

  const attributeEntries = useMemo(
    () =>
      ATTRIBUTE_KEYS.map((key) => ({
        key,
        metadata: ATTRIBUTE_METADATA[key],
      })),
    [],
  );

  const slotNumber = existingProfile?.slot_number ?? 1;
  const unlockCost = existingProfile?.unlock_cost ?? 0;
  const isActive = existingProfile?.is_active ?? true;

  const selectedStyleDefinition = useMemo(
    () => avatarStyles.find((style) => style.id === selectedAvatarStyle) ?? avatarStyles[0],
    [selectedAvatarStyle],
  );

  const selectedPoseDefinition = useMemo(
    () => avatarPoses.find((pose) => pose.id === selectedAvatarPose) ?? avatarPoses[0],
    [selectedAvatarPose],
  );

  const selectedCameraDefinition = useMemo(
    () => avatarCameras.find((angle) => angle.id === selectedAvatarCamera) ?? avatarCameras[0],
    [selectedAvatarCamera],
  );

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const fetchExistingData = async () => {
      if (!user) return;

      setIsLoading(true);
      setLoadError(null);

      const scopedProfileId = targetProfileId;
      const shouldUseProfileScope = Boolean(scopedProfileId);

      try {
        const attributeSelect = [
          "id",
          "attribute_points",
          "attribute_points_spent",
          ...ATTRIBUTE_KEYS,
        ].join(", ");

        const [profileResponse, attributesResponse] = await Promise.all([
          shouldUseProfileScope
            ? supabase
                .from("profiles")
                .select("*")
                .eq("id", scopedProfileId)
                .maybeSingle()
            : supabase
                .from("profiles")
                .select("*")
                .eq("user_id", user.id)
                .maybeSingle(),
          shouldUseProfileScope
            ? supabase
                .from("player_attributes")
                .select(attributeSelect)
                .eq("profile_id", scopedProfileId)
                .maybeSingle()
            : supabase
                .from("player_attributes")
                .select(attributeSelect)
                .eq("user_id", user.id)
                .maybeSingle(),
        ]);

        if (profileResponse.error && profileResponse.status !== 406) {
          throw profileResponse.error;
        }

        if (attributesResponse.error && attributesResponse.status !== 406) {
          throw attributesResponse.error;
        }

        const profileData = (profileResponse.data as ProfileRow | null) ?? null;
        const attributesData = (attributesResponse.data as PlayerAttributesRow | null) ?? null;

        setExistingProfile(profileData);
        setExistingAttributes(attributesData);

        if (profileData) {
          if (profileData.display_name) {
            setDisplayName(profileData.display_name);
            setNameSuggestion(profileData.display_name);
          }
          if (profileData.username) {
            setUsername(profileData.username);
            setUsernameEdited(true);
          }
          setBio(profileData.bio ?? backgrounds[0].description);
          if (profileData.gender) {
            setGender(profileData.gender as ProfileGender);
          }
          if (typeof profileData.age === "number") {
            setAge(String(profileData.age));
          }
          setCityOfBirth(profileData.city_of_birth ?? null);

          if (profileData.avatar_url) {
            const storedSelection = getStoredAvatarSelection(profileResponse.data?.avatar_url);

            if (storedSelection) {
              if (avatarStyles.some((style) => style.id === storedSelection.styleId)) {
                setSelectedAvatarStyle(storedSelection.styleId);
              }

              if (avatarPoses.some((pose) => pose.id === storedSelection.poseId)) {
                setSelectedAvatarPose(storedSelection.poseId);
              }

              if (avatarCameras.some((angle) => angle.id === storedSelection.cameraId)) {
                setSelectedAvatarCamera(storedSelection.cameraId);
              }
            } else {
              const match = avatarStyles.find((style) =>
                profileResponse.data?.avatar_url?.includes(`/7.x/${style.id}/`)
              );
              if (match) {
                setSelectedAvatarStyle(match.id);
              }
            }
          }
        } else {
          setBio(backgrounds[0].description);
          setUsernameEdited(false);
        }

        const normalizedAttributesRow = attributesData
          ? { ...(attributesData as Record<string, unknown>) }
          : null;

        setAttributes((previous) =>
          buildAttributeStateFromRecord(normalizedAttributesRow, ATTRIBUTE_KEYS, previous),
        );
      } catch (error) {
        console.error("Failed to load character data:", error);
        setLoadError("We couldn't load your character data. You can still create a new persona.");
        setExistingProfile(null);
        setExistingAttributes(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      void fetchExistingData();
    }
  }, [user, targetProfileId]);

  useEffect(() => {
    if (!loading && !isLoading && existingProfile && !fromProfileFlow) {
      navigate("/profile", { replace: true });
    }
  }, [loading, isLoading, existingProfile, fromProfileFlow, navigate]);

  useEffect(() => {
    const fetchCities = async () => {
      try {
        setCitiesLoading(true);
        setCitiesError(null);

        const { data, error } = await supabase
          .from("cities")
          .select("id, name, country")
          .order("name", { ascending: true });

        if (error) throw error;

        const sanitizedCities = ((data as CityOption[] | null) ?? []).filter(
          (city): city is CityOption => typeof city.id === "string" && city.id.trim().length > 0,
        );

        setCities(sanitizedCities);
      } catch (error) {
        console.error("Failed to load cities:", error);
        setCitiesError("We couldn't load cities right now. You can update this later in your profile.");
      } finally {
        setCitiesLoading(false);
      }
    };

    void fetchCities();
  }, []);

  const avatarPreviewUrl = (styleId: string) => {
    const seed = encodeURIComponent(
      username || displayName || nameSuggestion || user?.id || "rockmundo"
    );
    return `https://api.dicebear.com/7.x/${styleId}/svg?seed=${seed}`;
  };

  const handleRegenerateName = () => {
    const suggestion = generateRandomName();
    setNameSuggestion(suggestion);
    if (!displayName) {
      setDisplayName(suggestion);
    }
    if (!usernameEdited) {
      setUsername(generateHandleFromName(suggestion));
      setUsernameEdited(false);
    }
  };

  const handleAcceptName = () => {
    setDisplayName(nameSuggestion);
    setUsername(generateHandleFromName(nameSuggestion));
    setUsernameEdited(false);
  };

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (!usernameEdited) {
      const sanitized = sanitizeHandle(value);
      setUsername(sanitized || generateHandleFromName(value));
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameEdited(true);
  };

  const handleAttributeChange = (key: AttributeKey, value: number) => {
    setAttributes((prev) => {
      const clampedValue = normalizeAttributeValue(value);

      if (prev[key] === clampedValue) {
        return prev;
      }

      return {
        ...prev,
        [key]: clampedValue,
      };
    });
  };

  const totalAttributePoints = useMemo(
    () => Object.values(attributes).reduce((acc, val) => acc + val, 0),
    [attributes],
  );

  const handleSave = async () => {
    if (!user) return;

    const trimmedDisplayName = displayName.trim() || nameSuggestion;
    const trimmedUsername = username.trim();

    if (!trimmedDisplayName) {
      toast({
        title: "Display name required",
        description: "Choose a stage name for your artist persona.",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedUsername) {
      toast({
        title: "Artist handle required",
        description: "Create a handle so other players can find you.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    console.info("[CharacterCreation] Starting character save", {
      userId: user.id,
      existingProfileId: existingProfile?.id ?? null,
      targetProfileId,
    });

    const selectedBackgroundDetails =
      backgrounds.find((bg) => bg.id === selectedBackground) ?? backgrounds[0];
    const finalBio = bio?.trim() || selectedBackgroundDetails.description;

    const parsedAgeValue = Number.parseInt(age, 10);
    const parsedAge = Number.isNaN(parsedAgeValue)
      ? existingProfile?.age ?? 16
      : Math.min(120, Math.max(13, parsedAgeValue));

    const activeStyle = selectedStyleDefinition ?? avatarStyles[0];
    const activePose = selectedPoseDefinition ?? avatarPoses[0];
    const activeCamera = selectedCameraDefinition ?? avatarCameras[0];

    const slotNumber =
      typeof existingProfile?.slot_number === "number" ? existingProfile.slot_number : 1;
    const unlockCost =
      typeof existingProfile?.unlock_cost === "number" ? existingProfile.unlock_cost : 0;
    const isActive = existingProfile?.is_active ?? true;

    const avatarSelection = {
      styleId: activeStyle?.id ?? defaultAvatarSelection.styleId,
      poseId: activePose?.id ?? defaultAvatarSelection.poseId,
      cameraId: activeCamera?.id ?? defaultAvatarSelection.cameraId,
    };

    const serializedAvatar = serializeAvatarData(
      avatarSelection,
      avatarPreviewUrl(avatarSelection.styleId),
    );

    const baseProfilePayload: Record<string, unknown> = {
      user_id: user.id,
      username: trimmedUsername,
      display_name: trimmedDisplayName,
      bio: finalBio,
      avatar_url: serializedAvatar,
      level: existingProfile?.level ?? 1,
      experience: existingProfile?.experience ?? 0,
      cash: existingProfile?.cash ?? 500,
      fans: existingProfile?.fans ?? 0,
      followers: existingProfile?.followers ?? 0,
      fame: existingProfile?.fame ?? 0,
      engagement_rate: existingProfile?.engagement_rate ?? 0,
      gender,
      age: parsedAge,
      city_of_birth: cityOfBirth,
      slot_number: slotNumber,
      unlock_cost: unlockCost,
      is_active: isActive,
    };

    let attemptedProfilePayload: Record<string, unknown> = { ...baseProfilePayload };
    let attemptedAttributesPayload: Record<string, unknown> | null = null;
    let currentStage: SaveFailureStage = "profile-upsert";


    try {
      const skippedProfileColumns = new Set<string>();
      let upsertedProfile: PlayerProfile | null = null;

      while (!upsertedProfile) {
        console.debug("[CharacterCreation] Attempting profile upsert", {
          payload: sanitizePayloadForLogging(attemptedProfilePayload),
          skippedColumns: [...skippedProfileColumns],
        });
        const { data, error: profileError } = await supabase
          .from("profiles")
          .upsert(attemptedProfilePayload as ProfileInsert, {
            onConflict: "user_id,slot_number",
          })
          .select()
          .single();

        if (!profileError) {
          upsertedProfile = data as PlayerProfile | null;
          break;
        }

        console.warn("[CharacterCreation] Profile upsert failed", {
          error: buildSaveErrorMessage(profileError),
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint,
          attemptedKeys: Object.keys(attemptedProfilePayload),
        });

        const missingColumn = extractMissingColumn(profileError);
        if (
          missingColumn &&
          !skippedProfileColumns.has(missingColumn) &&
          missingColumn in attemptedProfilePayload
        ) {
          skippedProfileColumns.add(missingColumn);
          attemptedProfilePayload = omitFromRecord(attemptedProfilePayload, missingColumn);
          console.warn("[CharacterCreation] Retrying profile upsert without column", {
            missingColumn,
            remainingKeys: Object.keys(attemptedProfilePayload),
          });
          continue;
        }

        throw profileError;
      }

      if (!upsertedProfile) {
        throw new Error("Profile save did not return any data.");
      }

      currentStage = "ensure-wardrobe";

      const ensuredLoadout = await ensureDefaultWardrobe(
        upsertedProfile.id,
        user.id,
        parseClothingLoadout(
          (existingProfile ?? upsertedProfile)?.equipped_clothing,
        ),
      );

      if (ensuredLoadout) {
        upsertedProfile = {
          ...upsertedProfile,
          equipped_clothing: ensuredLoadout as PlayerProfile["equipped_clothing"],
        };
      }

      setExistingProfile(upsertedProfile);

      currentStage = "attribute-upsert";

      const normalizedAttributes = ATTRIBUTE_KEYS.reduce<Record<AttributeKey, number>>(
        (accumulator, key) => {
          const rawValue = attributes[key];
          accumulator[key] = normalizeAttributeValue(rawValue);
          return accumulator;
        },
        {} as Record<AttributeKey, number>,
      );

      const totalAllocatedAttributePoints = Object.values(normalizedAttributes).reduce(
        (acc, val) => acc + val,
        0,
      );

      const existingAttributePoints = Math.max(
        0,
        Math.round(coerceNumber(existingAttributes?.attribute_points) ?? 0),
      );
      const existingAttributePointsSpent = coerceNumber(
        existingAttributes?.attribute_points_spent,
      );
      const resolvedAttributePointsSpent = Math.max(
        0,
        Math.round(
          typeof existingAttributePointsSpent === "number"
            ? existingAttributePointsSpent
            : totalAllocatedAttributePoints,
        ),
      );

      const baseAttributesPayload: Record<string, unknown> = {
        user_id: user.id,
        profile_id: upsertedProfile.id,
        attribute_points: existingAttributePoints,
        attribute_points_spent: resolvedAttributePointsSpent,
        ...normalizedAttributes,
      };

      attemptedAttributesPayload = { ...baseAttributesPayload };
      const skippedAttributeColumns = new Set<string>();
      let finalAttributesRow: PlayerAttributesRow | null = null;

      while (Object.keys(attemptedAttributesPayload).length > 0) {
        console.debug("[CharacterCreation] Attempting attribute upsert", {
          payload: sanitizePayloadForLogging(attemptedAttributesPayload),
          skippedColumns: [...skippedAttributeColumns],
        });
        const { data: upsertedAttributes, error: attributesError } = await supabase
          .from("player_attributes")
          .upsert(attemptedAttributesPayload as PlayerAttributesInsert, {
            onConflict: "profile_id",
          })
          .select()
          .maybeSingle();

        if (!attributesError) {
          finalAttributesRow = (upsertedAttributes as PlayerAttributesRow | null) ?? null;
          break;
        }

        if (attributesError.code === "42703") {
          const missingColumn = extractMissingColumn(attributesError);
          if (
            missingColumn &&
            !skippedAttributeColumns.has(missingColumn) &&
            missingColumn in attemptedAttributesPayload &&
            missingColumn !== "profile_id"
          ) {
            skippedAttributeColumns.add(missingColumn);
            attemptedAttributesPayload = omitFromRecord(attemptedAttributesPayload, missingColumn);
            console.warn("[CharacterCreation] Retrying attribute upsert without column", {
              missingColumn,
              remainingKeys: Object.keys(attemptedAttributesPayload),
            });
            continue;
          }
        }

        throw attributesError;
      }

      const persistedAttributesRecord = finalAttributesRow
        ? { ...(finalAttributesRow as Record<string, unknown>) }
        : { ...attemptedAttributesPayload };

      setExistingAttributes((previous) => ({
        ...(previous ?? {}) as PlayerAttributesRow,
        ...(persistedAttributesRecord as Partial<PlayerAttributesRow>),
      }));

      setAttributes((previous) =>
        buildAttributeStateFromRecord(persistedAttributesRecord, ATTRIBUTE_KEYS, previous),
      );

      currentStage = "refresh-characters";
      await refreshCharacters();

      currentStage = "activate-character";
      await setActiveCharacter(upsertedProfile.id);

      console.info("[CharacterCreation] Character save complete", {
        profileId: upsertedProfile.id,
        userId: user.id,
        skippedProfileColumns: [...skippedProfileColumns],
        skippedAttributeColumns: [...skippedAttributeColumns],
      });

      toast({
        title: "Character ready!",
        description: "Your artist profile has been saved. Time to take the stage.",
      });

      window.dispatchEvent(new CustomEvent("profile-updated"));

      navigate("/dashboard");
    } catch (error) {
      const errorState = buildSaveErrorState(
        error,
        currentStage,
        attemptedProfilePayload,
        attemptedAttributesPayload,
      );

      console.error("[CharacterCreation] Failed to save character", {
        stage: currentStage,
        stageLabel: SAVE_ERROR_STAGE_LABELS[currentStage] ?? SAVE_ERROR_STAGE_LABELS.unknown,
        errorState,
        rawError: error,
        userId: user.id,
      });

      setSaveError(errorState);

      const toastDescriptionParts = [
        errorState.friendlyMessage ?? errorState.message,
        errorState.code ? `Error code: ${errorState.code}` : null,
        `Step: ${SAVE_ERROR_STAGE_LABELS[currentStage] ?? SAVE_ERROR_STAGE_LABELS.unknown}`,
        errorState.duplicateField && errorState.duplicateValue
          ? `${errorState.duplicateField}: ${errorState.duplicateValue}`
          : null,
      ].filter((part): part is string => Boolean(part));

      toast({
        title: "Could not save character",
        description: toastDescriptionParts.join(" — "),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    navigate("/dashboard");
  };

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-stage">
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-lg font-oswald text-foreground/80">
            Crafting your Rockmundo persona...
          </p>
        </div>
      </div>
    );
  }
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-3 text-center">
          <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-widest">
            Character Creation
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Design Your Stage Persona
          </h1>
          <p className="text-base text-muted-foreground">
            Shape your artist identity, pick a backstory, and define the attributes that set your playstyle in motion.
          </p>
        </div>

        {loadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>Heads up!</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {saveError && (
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>Unable to save</AlertTitle>
            <AlertDescription>
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive-foreground">
                  {saveError.friendlyMessage ?? saveError.message}
                </p>
                <div className="space-y-1 text-xs text-destructive-foreground opacity-90">
                  <div>
                    <span className="font-semibold text-destructive-foreground">Step:</span>{" "}
                    {SAVE_ERROR_STAGE_LABELS[saveError.stage] ?? SAVE_ERROR_STAGE_LABELS.unknown}
                  </div>
                  {saveError.code && (
                    <div>
                      <span className="font-semibold text-destructive-foreground">Supabase code:</span>{" "}
                      {saveError.code}
                    </div>
                  )}
                  {saveError.duplicateField && saveError.duplicateValue && (
                    <div>
                      <span className="font-semibold text-destructive-foreground">Conflict:</span>{" "}
                      {saveError.duplicateField} = {saveError.duplicateValue}
                    </div>
                  )}
                  {saveError.constraint && (
                    <div>
                      <span className="font-semibold text-destructive-foreground">Constraint:</span>{" "}
                      {saveError.constraint}
                    </div>
                  )}
                  {saveError.details && (
                    <div>
                      <span className="font-semibold text-destructive-foreground">Details:</span>{" "}
                      {saveError.details}
                    </div>
                  )}
                  {saveError.hint && (
                    <div>
                      <span className="font-semibold text-destructive-foreground">Hint:</span>{" "}
                      {saveError.hint}
                    </div>
                  )}
                  {saveError.friendlyMessage && saveError.friendlyMessage !== saveError.message && (
                    <div>
                      <span className="font-semibold text-destructive-foreground">Server message:</span>{" "}
                      {saveError.message}
                    </div>
                  )}
                </div>
                {(saveError.profilePayload || saveError.attributesPayload) && (
                  <details className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">
                    <summary className="cursor-pointer font-semibold">
                      View data we attempted to save
                    </summary>
                    <div className="space-y-2">
                      {saveError.profilePayload && (
                        <div className="space-y-1">
                          <div className="font-semibold">Profile payload</div>
                          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-destructive/20 p-2 text-[11px] leading-relaxed">
                            {JSON.stringify(saveError.profilePayload, null, 2)}
                          </pre>
                        </div>
                      )}
                      {saveError.attributesPayload && (
                        <div className="space-y-1">
                          <div className="font-semibold">Attribute payload</div>
                          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-destructive/20 p-2 text-[11px] leading-relaxed">
                            {JSON.stringify(saveError.attributesPayload, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-primary/20 bg-background/80 shadow-lg backdrop-blur">
          <CardHeader className="flex flex-col gap-2 text-center sm:text-left sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-2xl font-semibold">Your Signature Sound</CardTitle>
              <CardDescription>
                Start with a bold alias and tailor it until it feels unmistakably yours.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={handleRegenerateName}>
                <Wand2 className="mr-2 h-4 w-4" />
                New Suggestion
              </Button>
              <Button variant="outline" onClick={handleAcceptName}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Use Suggestion
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Stage Name</label>
                  <Input
                    placeholder="Your iconic display name"
                    value={displayName}
                    onChange={(event) => handleDisplayNameChange(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Artist Handle</label>
                  <Input
                    placeholder="unique-handle-123"
                    value={username}
                    onChange={(event) => handleUsernameChange(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Handles help friends find you across the Rockmundo universe. Use letters, numbers, and dashes.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Signature Bio</label>
                  <Textarea
                    rows={4}
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="Tell the world who you are, what drives your music, and the vibes you bring to every stage."
                  />
                </div>
              </div>
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-primary/10 bg-muted/40 p-6">
                <AvatarPreview3D
                  style={selectedStyleDefinition ?? avatarStyles[0]}
                  pose={selectedPoseDefinition ?? avatarPoses[0]}
                  camera={selectedCameraDefinition ?? avatarCameras[0]}
                  className="h-44 w-44"
                />
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedStyleDefinition?.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedPoseDefinition?.label} • {selectedCameraDefinition?.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This preview updates as you tweak style, pose, and camera.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-background/80 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette className="h-5 w-5 text-primary" />
              Choose Your Look
            </CardTitle>
            <CardDescription>
              Select the vibe that best represents your persona. You can change it later as your story evolves.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {avatarStyles.map((style) => {
                const isActive = selectedAvatarStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setSelectedAvatarStyle(style.id)}
                    className={cn(
                      "group relative flex h-full flex-col gap-3 overflow-hidden rounded-lg border bg-gradient-to-br p-4 text-left transition shadow-sm",
                      style.gradient,
                      isActive
                        ? "border-primary shadow-lg"
                        : "border-transparent opacity-90 hover:opacity-100",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-background drop-shadow-sm">
                        {style.label}
                      </h3>
                      {isActive && (
                        <span className="rounded-full bg-background/80 px-2 py-1 text-xs font-medium text-foreground">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-background/80 group-hover:text-background">
                      {style.description}
                    </p>
                    <div className="mt-auto flex items-center gap-1 rounded-md border border-background/40 bg-background/40 p-2">
                      <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-background/50 to-background/20">
                        <div
                          className="h-full w-full rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${style.palette.primary}, ${style.palette.accent}, ${style.palette.secondary})`,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  <Move3d className="h-4 w-4 text-primary" /> Pose
                </div>
                <div className="space-y-2">
                  {avatarPoses.map((poseOption) => {
                    const isActive = selectedAvatarPose === poseOption.id;
                    return (
                      <button
                        key={poseOption.id}
                        type="button"
                        onClick={() => setSelectedAvatarPose(poseOption.id)}
                        className={cn(
                          "w-full rounded-md border px-4 py-3 text-left transition",
                          isActive
                            ? "border-primary bg-primary/10 shadow"
                            : "border-border bg-background/60 hover:border-primary/60",
                        )}
                      >
                        <p className="text-sm font-semibold text-foreground">{poseOption.label}</p>
                        <p className="text-xs text-muted-foreground">{poseOption.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  <Camera className="h-4 w-4 text-primary" /> Camera
                </div>
                <div className="space-y-2">
                  {avatarCameras.map((cameraOption) => {
                    const isActive = selectedAvatarCamera === cameraOption.id;
                    return (
                      <button
                        key={cameraOption.id}
                        type="button"
                        onClick={() => setSelectedAvatarCamera(cameraOption.id)}
                        className={cn(
                          "w-full rounded-md border px-4 py-3 text-left transition",
                          isActive
                            ? "border-primary bg-primary/10 shadow"
                            : "border-border bg-background/60 hover:border-primary/60",
                        )}
                      >
                        <p className="text-sm font-semibold text-foreground">{cameraOption.label}</p>
                        <p className="text-xs text-muted-foreground">{cameraOption.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-background/80 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <SparklesIcon className="h-5 w-5 text-primary" />
              Backstory & Motivation
            </CardTitle>
            <CardDescription>
              Your origin sets the tone for in-game narrative moments and fan expectations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {backgrounds.map((background) => (
                <button
                  key={background.id}
                  type="button"
                  onClick={() => {
                    setSelectedBackground(background.id);
                    if (!bio || bio === backgrounds[0].description) {
                      setBio(background.description);
                    }
                  }}
                  className={cn(
                    "flex h-full flex-col gap-2 rounded-lg border p-4 text-left transition",
                    selectedBackground === background.id
                      ? "border-primary bg-primary/5 shadow"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    {background.label}
                    {selectedBackground === background.id && (
                      <Badge variant="secondary" className="text-xs">
                        Active
                      </Badge>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">{background.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-background/80 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" />
              Identity Details
            </CardTitle>
            <CardDescription>
              A few personal touches to give your artist a grounded origin story.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="gender">
                  Gender
                </label>
                <Select value={gender} onValueChange={(value) => setGender(value as ProfileGender)}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select a gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {genderOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="age">
                  Age
                </label>
                <Input
                  id="age"
                  type="number"
                  min={13}
                  max={120}
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Default starting age is 16.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="city-of-birth">
                  City of Birth
                </label>
                <Select
                  value={cityOfBirth ?? NO_CITY_SELECTED_VALUE}
                  onValueChange={(value) =>
                    setCityOfBirth(value === NO_CITY_SELECTED_VALUE ? null : value)
                  }
                  disabled={citiesLoading}
                >
                  <SelectTrigger id="city-of-birth">
                    <SelectValue
                      placeholder={citiesLoading ? "Loading cities..." : "Select a city"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CITY_SELECTED_VALUE}>No listed city</SelectItem>
                    {cities.map((city) => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name ?? "Unnamed City"}
                        {city.country ? `, ${city.country}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {citiesError && (
                  <p className="text-xs text-destructive">{citiesError}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-background/80 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="h-5 w-5 text-primary" />
              Attribute Distribution
            </CardTitle>
            <CardDescription>
              Invest your starting attribute strengths. These values influence performance, creativity, and career growth and can be trained further in-game.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-primary space-y-2">
              <div className="flex items-center justify-between">
                <span>Total Attribute Investment</span>
                <span className="font-semibold">{totalAttributePoints}</span>
              </div>
              <p className="text-xs text-primary/80">
                Attributes range from {MIN_ATTRIBUTE_VALUE} to {MAX_ATTRIBUTE_VALUE}. Your starting distribution sets the tone for your artist&apos;s playstyle.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {attributeEntries.map(({ key, metadata }) => {
                const currentValue = attributes[key] ?? MIN_ATTRIBUTE_VALUE;

                return (
                  <div key={key} className="space-y-3 rounded-lg border border-border/70 bg-muted/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-sm font-medium">{metadata.label}</span>
                        <p className="text-xs text-muted-foreground leading-snug">{metadata.description}</p>
                      </div>
                      <span className="text-sm font-semibold text-primary">{currentValue}</span>
                    </div>
                    <Slider
                      min={MIN_ATTRIBUTE_VALUE}
                      max={MAX_ATTRIBUTE_VALUE}
                      step={1}
                      value={[currentValue]}
                      onValueChange={([value]) => handleAttributeChange(key, value ?? currentValue)}
                    />
                    {metadata.relatedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {metadata.relatedSkills.map((skill) => (
                          <Badge
                            key={`${key}-${skill}`}
                            variant="outline"
                            className="text-[10px] uppercase tracking-wider"
                          >
                            {formatDisplayName(skill)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
            Skip for now
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Confirm Character"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CharacterCreation;
