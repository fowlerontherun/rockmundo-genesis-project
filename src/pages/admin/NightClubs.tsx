import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { AdminRoute } from "@/components/AdminRoute";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

import {
  currencyFormatter,
  formatNumberInput,
  parseCommaSeparatedInput,
  parseNumberInput,
} from "./shared";

const QUALITY_LABELS: Record<number, string> = {
  1: "Underground",
  2: "Neighborhood",
  3: "Boutique",
  4: "Premier",
  5: "Legendary",
};

const createQualityLevelField = () =>
  z
    .string()
    .trim()
    .min(1, "Quality level is required")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5;
    }, "Quality level must be an integer between 1 and 5");

const optionalNumberField = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => {
      if (!value) return true;
      const parsed = Number(value);
      return Number.isFinite(parsed);
    }, `${label} must be a valid number`)
    .optional();

const requiredNumberField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed);
    }, `${label} must be a valid number`);

const guestActionSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1, "Guest action label is required"),
  description: z.string().trim().optional(),
  energyCost: optionalNumberField("Energy cost"),
});

const drinkSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "Drink name is required"),
  price: optionalNumberField("Price"),
  effect: z.string().trim().optional(),
});

const npcSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "NPC name is required"),
  role: z.string().trim().optional(),
  personality: z.string().trim().optional(),
  availability: z.string().trim().optional(),
  dialogueTopics: z.string().trim().optional(),
});

const perkSchema = z.object({
  id: z.string(),
  value: z.string().trim().min(1, "Perk cannot be empty"),
});

const djSlotSchema = z.object({
  minimum_fame: requiredNumberField("Minimum fame"),
  payout: optionalNumberField("Payout"),
  schedule: z.string().trim().optional(),
  set_length_minutes: optionalNumberField("Set length"),
  perks: z.array(perkSchema).default([]),
  song_ids: z.array(z.string()).min(1, "Select at least one released song for DJ sets"),
});

const nightClubSchema = z.object({
  city_id: z.string().trim().min(1, "City is required"),
  name: z.string().trim().min(1, "Club name is required"),
  description: z.string().trim().optional(),
  quality_level: createQualityLevelField(),
  capacity: optionalNumberField("Capacity"),
  cover_charge: optionalNumberField("Cover charge"),
  guest_actions: z.array(guestActionSchema).default([]),
  drink_menu: z.array(drinkSchema).default([]),
  npc_profiles: z.array(npcSchema).default([]),
  dj_slot_config: djSlotSchema,
  live_interactions_enabled: z.boolean().default(true),
});


type NightClubFormValues = z.infer<typeof nightClubSchema>;

type CityOption = {
  id: string;
  name: string;
};

type NightClubRow = {
  id: string;
  city_id: string;
  name: string | null;
  description: string | null;
  quality_level: number | null;
  capacity: number | null;
  cover_charge: number | null;
  guest_actions: unknown[] | null;
  drink_menu: unknown[] | null;
  npc_profiles: unknown[] | null;
  dj_slot_config: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
  city?: {
    name: string | null;
  } | null;
};

type SongOption = {
  id: string;
  title: string;
  genre: string | null;
};

type GuestActionFormValue = NightClubFormValues["guest_actions"][number];
type DrinkFormValue = NightClubFormValues["drink_menu"][number];
type NpcFormValue = NightClubFormValues["npc_profiles"][number];
type PerkFormValue = NightClubFormValues["dj_slot_config"]["perks"][number];
type DjSlotFormValue = NightClubFormValues["dj_slot_config"];

const createGuestActionField = (): GuestActionFormValue => ({
  id: crypto.randomUUID(),
  label: "",
  description: "",
  energyCost: "",
});

const createDrinkField = (): DrinkFormValue => ({
  id: crypto.randomUUID(),
  name: "",
  price: "",
  effect: "",
});

const createNpcField = (): NpcFormValue => ({
  id: crypto.randomUUID(),
  name: "",
  role: "",
  personality: "",
  availability: "",
  dialogueTopics: "",
});

const createPerkField = (): PerkFormValue => ({
  id: crypto.randomUUID(),
  value: "",
});

const nightClubDefaultValues: NightClubFormValues = {
  city_id: "",
  name: "",
  description: "",
  quality_level: "3",
  capacity: "",
  cover_charge: "",
  guest_actions: [],
  drink_menu: [],
  npc_profiles: [],
  dj_slot_config: {
    minimum_fame: "750",
    payout: "",
    schedule: "",
    set_length_minutes: "60",
    perks: [],
    song_ids: [],
  },
  live_interactions_enabled: true,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const formatNumericField = (value: unknown, fallback = ""): string => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatNumberInput(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return `${parsed}`;
    }

    return value.trim();
  }

  return fallback;
};

const extractSongIds = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.reduce<string[]>((acc, entry) => {
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (trimmed) {
          acc.push(trimmed);
        }
        return acc;
      }

      if (isRecord(entry) && typeof entry.id === "string") {
        const trimmed = entry.id.trim();
        if (trimmed) {
          acc.push(trimmed);
        }
      }

      return acc;
    }, []);
  }

  if (isRecord(value)) {
    const candidate =
      value.song_ids ?? value.songIds ?? value.songs ?? value.available_song_ids ?? value.ids;
    return extractSongIds(candidate);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return extractSongIds(parsed);
      }
    } catch (error) {
      console.warn("Unable to parse song identifiers", error);
    }

    return value
      .split(/[,\n\t\s]+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
  }

  return [];
};


const mapGuestActionsToForm = (value: unknown[] | null | undefined): GuestActionFormValue[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<GuestActionFormValue[]>((acc, entry, index) => {
    if (typeof entry === "string") {
      acc.push({
        id: `guest-action-${index}`,
        label: entry,
        description: "",
        energyCost: "",
      });
      return acc;
    }

    if (!isRecord(entry)) {
      return acc;
    }

    const label =
      typeof entry.label === "string"
        ? entry.label
        : typeof entry.name === "string"
          ? entry.name
          : "";
    const description = typeof entry.description === "string" ? entry.description : "";
    const energySource = entry.energy_cost ?? entry.energyCost;
    const energyCost = formatNumericField(energySource, "");

    acc.push({
      id: typeof entry.id === "string" ? entry.id : `guest-action-${index}`,
      label,
      description,
      energyCost,
    });
    return acc;
  }, []);
};

const mapDrinkMenuToForm = (value: unknown[] | null | undefined): DrinkFormValue[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<DrinkFormValue[]>((acc, entry, index) => {
    if (typeof entry === "string") {
      acc.push({
        id: `drink-${index}`,
        name: entry,
        price: "",
        effect: "",
      });
      return acc;
    }

    if (!isRecord(entry)) {
      return acc;
    }

    const name =
      typeof entry.name === "string"
        ? entry.name
        : typeof entry.label === "string"
          ? entry.label
          : "";
    const effect =
      typeof entry.effect === "string"
        ? entry.effect
        : typeof entry.bonus === "string"
          ? entry.bonus
          : "";
    const price = formatNumericField(entry.price ?? entry.cost ?? entry.value, "");

    acc.push({
      id: typeof entry.id === "string" ? entry.id : `drink-${index}`,
      name,
      effect,
      price,
    });
    return acc;
  }, []);
};

const mapNpcProfilesToForm = (value: unknown[] | null | undefined): NpcFormValue[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<NpcFormValue[]>((acc, entry, index) => {
    if (typeof entry === "string") {
      acc.push({
        id: `npc-${index}`,
        name: entry,
        role: "",
        personality: "",
        availability: "",
        dialogueTopics: "",
      });
      return acc;
    }

    if (!isRecord(entry)) {
      return acc;
    }

    const name =
      typeof entry.name === "string"
        ? entry.name
        : typeof entry.handle === "string"
          ? entry.handle
          : "";
    const role =
      typeof entry.role === "string"
        ? entry.role
        : typeof entry.title === "string"
          ? entry.title
          : "";
    const personality =
      typeof entry.personality === "string"
        ? entry.personality
        : typeof entry.vibe === "string"
          ? entry.vibe
          : "";
    const availability =
      typeof entry.availability === "string"
        ? entry.availability
        : typeof entry.schedule === "string"
          ? entry.schedule
          : "";
    const dialogueHooks = Array.isArray(entry.dialogue_hooks ?? entry.dialogue ?? entry.prompts)
      ? (entry.dialogue_hooks ?? entry.dialogue ?? entry.prompts)
          .filter((hook): hook is string => typeof hook === "string" && hook.trim().length > 0)
          .map((hook) => hook.trim())
      : [];

    acc.push({
      id: typeof entry.id === "string" ? entry.id : `npc-${index}`,
      name,
      role,
      personality,
      availability,
      dialogueTopics: dialogueHooks.length ? dialogueHooks.join(", ") : "",
    });
    return acc;
  }, []);
};

const mapPerksToForm = (value: unknown): PerkFormValue[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.reduce<PerkFormValue[]>((acc, entry, index) => {
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (trimmed) {
          acc.push({ id: `perk-${index}`, value: trimmed });
        }
        return acc;
      }

      if (isRecord(entry)) {
        const rawValue =
          typeof entry.value === "string"
            ? entry.value
            : typeof entry.label === "string"
              ? entry.label
              : undefined;
        if (rawValue && rawValue.trim()) {
          acc.push({
            id: typeof entry.id === "string" ? entry.id : `perk-${index}`,
            value: rawValue.trim(),
          });
        }
      }

      return acc;
    }, []);
  }

  if (typeof value === "string") {
    return parseCommaSeparatedInput(value).map((entry, index) => ({
      id: `perk-${index}`,
      value: entry,
    }));
  }

  return [];
};

const mapDjSlotToForm = (
  rawConfig: Record<string, unknown> | null | undefined,
  qualityLevel: number | null | undefined,
): DjSlotFormValue => {
  const boundedQuality = Math.max(1, Math.min(5, Math.round(qualityLevel ?? 1)));
  const defaultMinimumFame = `${boundedQuality * 250}`;

  if (!rawConfig) {
    return {
      minimum_fame: defaultMinimumFame,
      payout: "",
      schedule: "",
      set_length_minutes: "",
      perks: [],
      song_ids: [],
    };
  }

  const minimumFame = formatNumericField(
    rawConfig.minimum_fame ?? rawConfig.fame_requirement ?? rawConfig.requirements?.fame,
    defaultMinimumFame,
  );
  const payout = formatNumericField(rawConfig.payout ?? rawConfig.payment ?? rawConfig.fee, "");
  const setLength = formatNumericField(
    rawConfig.set_length_minutes ?? rawConfig.setLength ?? rawConfig.duration_minutes ?? rawConfig.duration,
    "",
  );
  const schedule =
    typeof rawConfig.schedule === "string"
      ? rawConfig.schedule
      : typeof rawConfig.window === "string"
        ? rawConfig.window
        : typeof rawConfig.timeslot === "string"
          ? rawConfig.timeslot
          : "";
  const perks = mapPerksToForm(
    rawConfig.perks ?? rawConfig.rewards ?? rawConfig.bonuses ?? rawConfig.set_perks,
  );
  const songIds = extractSongIds(
    rawConfig.song_ids ?? rawConfig.songIds ?? rawConfig.songs ?? rawConfig.available_song_ids,
  );

  return {
    minimum_fame: minimumFame || defaultMinimumFame,
    payout,
    schedule,
    set_length_minutes: setLength,
    perks,
    song_ids: songIds,
  };
};

const parseDialogueTopicsInput = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(/[,\n]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const normalizeGuestActionsPayload = (actions: NightClubFormValues["guest_actions"]) =>
  actions.reduce<Record<string, unknown>[]>((acc, action) => {
    const label = action.label.trim();
    if (!label) {
      return acc;
    }

    const payload: Record<string, unknown> = {
      id: action.id,
      label,
    };

    if (action.description?.trim()) {
      payload.description = action.description.trim();
    }

    const energy = action.energyCost ? parseNumberInput(action.energyCost) : null;
    payload.energy_cost = energy;

    acc.push(payload);
    return acc;
  }, []);

const normalizeDrinkMenuPayload = (drinks: NightClubFormValues["drink_menu"]) =>
  drinks.reduce<Record<string, unknown>[]>((acc, drink) => {
    const name = drink.name.trim();
    if (!name) {
      return acc;
    }

    const payload: Record<string, unknown> = {
      id: drink.id,
      name,
    };

    const price = drink.price ? parseNumberInput(drink.price) : null;
    payload.price = price;

    if (drink.effect?.trim()) {
      payload.effect = drink.effect.trim();
    }

    acc.push(payload);
    return acc;
  }, []);

const normalizeNpcProfilesPayload = (profiles: NightClubFormValues["npc_profiles"]) =>
  profiles.reduce<Record<string, unknown>[]>((acc, npc) => {
    const name = npc.name.trim();
    if (!name) {
      return acc;
    }

    const payload: Record<string, unknown> = {
      id: npc.id,
      name,
    };

    if (npc.role?.trim()) {
      payload.role = npc.role.trim();
    }

    if (npc.personality?.trim()) {
      payload.personality = npc.personality.trim();
    }

    if (npc.availability?.trim()) {
      payload.availability = npc.availability.trim();
    }

    const dialogueHooks = parseDialogueTopicsInput(npc.dialogueTopics);
    if (dialogueHooks.length) {
      payload.dialogue_hooks = dialogueHooks;
    }

    acc.push(payload);
    return acc;
  }, []);

const normalizePerksPayload = (perks: NightClubFormValues["dj_slot_config"]["perks"]) =>
  perks
    .map((perk) => perk.value.trim())
    .filter((perk) => perk.length > 0);

const computeFameRequirement = (club: NightClubRow): number => {
  const quality = typeof club.quality_level === "number" && Number.isFinite(club.quality_level)
    ? Math.max(1, Math.min(5, Math.round(club.quality_level)))
    : 1;

  if (club.dj_slot_config && isRecord(club.dj_slot_config)) {
    const raw = club.dj_slot_config;
    const candidate =
      raw.minimum_fame ??
      raw.minimumFame ??
      (isRecord(raw.requirements) ? raw.requirements.fame : undefined);
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return quality * 250;
};

const parseLiveInteractionFlag = (club: NightClubRow): boolean => {
  const value =
    club.metadata?.live_interactions_enabled ?? club.metadata?.liveInteractionsEnabled;
  return typeof value === "boolean" ? value : true;
};

const qualityLabel = (club: NightClubRow) => {
  if (typeof club.quality_level !== "number") {
    return "Tier 1";
  }
  const tier = Math.max(1, Math.min(5, Math.round(club.quality_level)));
  return QUALITY_LABELS[tier] ?? `Tier ${tier}`;
};

const NightClubsAdmin = () => {
  const { toast } = useToast();
  const [cities, setCities] = useState<CityOption[]>([]);
  const [nightClubs, setNightClubs] = useState<NightClubRow[]>([]);
  const [releasedSongs, setReleasedSongs] = useState<SongOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [songsLoading, setSongsLoading] = useState(true);
  const [songsError, setSongsError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingClub, setEditingClub] = useState<NightClubRow | null>(null);
  const [deletingClubId, setDeletingClubId] = useState<string | null>(null);

  const nightClubForm = useForm<NightClubFormValues>({
    resolver: zodResolver(nightClubSchema),
    defaultValues: nightClubDefaultValues,
    mode: "onBlur",
  });

  const {
    fields: guestActionFields,
    append: appendGuestAction,
    remove: removeGuestAction,
    replace: replaceGuestActions,
  } = useFieldArray({ control: nightClubForm.control, name: "guest_actions" });

  const {
    fields: drinkMenuFields,
    append: appendDrink,
    remove: removeDrink,
    replace: replaceDrinkMenu,
  } = useFieldArray({ control: nightClubForm.control, name: "drink_menu" });

  const {
    fields: npcProfileFields,
    append: appendNpc,
    remove: removeNpc,
    replace: replaceNpcProfiles,
  } = useFieldArray({ control: nightClubForm.control, name: "npc_profiles" });

  const {
    fields: perkFields,
    append: appendPerk,
    remove: removePerk,
    replace: replacePerks,
  } = useFieldArray({ control: nightClubForm.control, name: "dj_slot_config.perks" });

  const fetchCities = useCallback(async () => {
    const { data, error } = await supabase
      .from("cities")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch cities", error);
      setLoadingError("Unable to load city list. Please try again later.");
      return;
    }

    setCities(
      (data ?? []).map((city) => ({
        id: city.id,
        name: city.name ?? "Unnamed city",
      })),
    );
  }, []);

  const fetchNightClubs = useCallback(async () => {
    setIsLoading(true);
    setLoadingError(null);

    const { data, error } = await supabase
      .from<NightClubRow>("city_night_clubs")
      .select("*, city:cities(name)")
      .order("quality_level", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch night clubs", error);
      setLoadingError("Unable to load night clubs. Ensure the migration has been applied.");
      setIsLoading(false);
      return;
    }

    setNightClubs(data ?? []);
    setIsLoading(false);
  }, []);

  const fetchReleasedSongs = useCallback(async () => {
    setSongsLoading(true);
    setSongsError(null);

    const { data, error } = await supabase
      .from("songs")
      .select("id, title, genre, status")
      .eq("status", "released")
      .order("title", { ascending: true })
      .limit(200);

    if (error) {
      console.error("Failed to fetch released songs", error);
      setSongsError(
        "Unable to load released songs. Publish tracks to let DJs pick from the catalogue.",
      );
      setReleasedSongs([]);
      setSongsLoading(false);
      return;
    }

    setReleasedSongs(
      (data ?? []).map((song) => ({
        id: song.id,
        title: song.title ?? "Untitled release",
        genre: song.genre ?? null,
      })),
    );
    setSongsLoading(false);
  }, []);

  useEffect(() => {
    void fetchCities();
    void fetchNightClubs();
    void fetchReleasedSongs();
  }, [fetchCities, fetchNightClubs, fetchReleasedSongs]);

  const resetForm = useCallback(() => {
    setEditingClub(null);
    nightClubForm.reset(nightClubDefaultValues);
    replaceGuestActions([]);
    replaceDrinkMenu([]);
    replaceNpcProfiles([]);
    replacePerks([]);
  }, [nightClubForm, replaceDrinkMenu, replaceGuestActions, replaceNpcProfiles, replacePerks]);

  const buildPayload = useCallback(
    (values: NightClubFormValues): Record<string, unknown> => {
      const metadataBase = editingClub?.metadata && typeof editingClub.metadata === "object"
        ? { ...editingClub.metadata }
        : {};

      metadataBase.live_interactions_enabled = values.live_interactions_enabled;

      const guestActions = normalizeGuestActionsPayload(values.guest_actions);
      const drinkMenu = normalizeDrinkMenuPayload(values.drink_menu);
      const npcProfiles = normalizeNpcProfilesPayload(values.npc_profiles);
      const perks = normalizePerksPayload(values.dj_slot_config.perks);
      const songIds = Array.from(new Set(values.dj_slot_config.song_ids));
      const fallbackMinimum =
        Math.max(1, Math.min(5, Math.round(Number(values.quality_level) || 1))) * 250;
      const minimumFame = parseNumberInput(values.dj_slot_config.minimum_fame) ?? fallbackMinimum;
      const payout = values.dj_slot_config.payout
        ? parseNumberInput(values.dj_slot_config.payout)
        : null;
      const setLength = values.dj_slot_config.set_length_minutes
        ? parseNumberInput(values.dj_slot_config.set_length_minutes)
        : null;
      const schedule = values.dj_slot_config.schedule?.trim() || null;

      return {
        city_id: values.city_id,
        name: values.name.trim(),
        description: values.description?.trim() ? values.description.trim() : null,
        quality_level: Number(values.quality_level),
        capacity: values.capacity ? parseNumberInput(values.capacity) : null,
        cover_charge: values.cover_charge ? parseNumberInput(values.cover_charge) : null,
        guest_actions: guestActions,
        drink_menu: drinkMenu,
        npc_profiles: npcProfiles,
        dj_slot_config: {
          minimum_fame: minimumFame,
          payout,
          set_length_minutes: setLength,
          schedule,
          perks,
          song_ids: songIds,
        },
        metadata: Object.keys(metadataBase).length ? metadataBase : null,
      };
    },
    [editingClub],
  );

  const onSubmit = nightClubForm.handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      const payload = buildPayload(values);
      if (editingClub) {
        const { error } = await supabase
          .from("city_night_clubs")
          .update(payload)
          .eq("id", editingClub.id);

        if (error) throw error;
        toast({
          title: "Night club updated",
          description: `${values.name} has been updated successfully.`,
        });
      } else {
        const { error } = await supabase.from("city_night_clubs").insert(payload);
        if (error) throw error;
        toast({
          title: "Night club created",
          description: `${values.name} has been added to the city roster.`,
        });
      }

      resetForm();
      await fetchNightClubs();
    } catch (error) {
      console.error("Failed to save night club", error);
      toast({
        title: "Unable to save night club",
        description: "Please review the form fields or try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleEdit = useCallback(
    (club: NightClubRow) => {
      setEditingClub(club);
      const guestActions = mapGuestActionsToForm(club.guest_actions);
      const drinkMenu = mapDrinkMenuToForm(club.drink_menu);
      const npcProfiles = mapNpcProfilesToForm(club.npc_profiles);
      const djSlot = mapDjSlotToForm(club.dj_slot_config, club.quality_level);

      nightClubForm.reset({
        city_id: club.city_id,
        name: club.name ?? "",
        description: club.description ?? "",
        quality_level: club.quality_level ? `${club.quality_level}` : "1",
        capacity: formatNumberInput(club.capacity),
        cover_charge: formatNumberInput(club.cover_charge),
        guest_actions: guestActions,
        drink_menu: drinkMenu,
        npc_profiles: npcProfiles,
        dj_slot_config: djSlot,
        live_interactions_enabled: parseLiveInteractionFlag(club),
      });

      replaceGuestActions(guestActions);
      replaceDrinkMenu(drinkMenu);
      replaceNpcProfiles(npcProfiles);
      replacePerks(djSlot.perks);
    },
    [nightClubForm, replaceDrinkMenu, replaceGuestActions, replaceNpcProfiles, replacePerks],
  );

  const handleDelete = useCallback(
    async (clubId: string) => {
      setDeletingClubId(clubId);
      try {
        const { error } = await supabase.from("city_night_clubs").delete().eq("id", clubId);
        if (error) throw error;
        toast({
          title: "Night club removed",
          description: "The night club has been deleted.",
        });
        if (editingClub?.id === clubId) {
          resetForm();
        }
        await fetchNightClubs();
      } catch (error) {
        console.error("Failed to delete night club", error);
        toast({
          title: "Unable to delete night club",
          description: "Please try again later.",
          variant: "destructive",
        });
      } finally {
        setDeletingClubId(null);
      }
    },
    [editingClub, fetchNightClubs, resetForm, toast],
  );

  const sortedCities = useMemo(
    () => cities.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [cities],
  );

  return (
    <AdminRoute>
      <div className="container mx-auto space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Night Clubs</h1>
          <p className="text-muted-foreground">
            Configure nightlife venues, DJ slot requirements, and social experiences linked to each city.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-primary" />
                {editingClub ? "Edit Night Club" : "Add Night Club"}
              </CardTitle>
              <CardDescription>
                {editingClub
                  ? "Update club details, DJ slot settings, and NPC rosters."
                  : "Create a new nightlife venue with configurable experiences."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...nightClubForm}>
                <form onSubmit={onSubmit} className="space-y-6">
                  <FormField
                    control={nightClubForm.control}
                    name="city_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a city" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sortedCities.map((city) => (
                              <SelectItem key={city.id} value={city.id}>
                                {city.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={nightClubForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Club name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Midnight Pulse" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={nightClubForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} placeholder="Describe the club's vibe, layout, and music policy." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={nightClubForm.control}
                      name="quality_level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quality tier (1-5)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min={1} max={5} placeholder="3" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={nightClubForm.control}
                      name="capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capacity</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min={0} placeholder="1200" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={nightClubForm.control}
                      name="cover_charge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cover charge</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min={0} step="1" placeholder="25" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-base">Guest experiences</FormLabel>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => appendGuestAction(createGuestActionField())}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" /> Add action
                      </Button>
                    </div>
                    <FormDescription>Configure activities available to visiting players.</FormDescription>
                    {guestActionFields.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
                        No guest actions configured yet. Add a few to highlight what fans can do between sets.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {guestActionFields.map((fieldItem, index) => (
                          <div key={fieldItem.id} className="space-y-3 rounded-md border border-border/60 p-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <FormField
                                control={nightClubForm.control}
                                name={`guest_actions.${index}.label` as const}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Action label</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="Start a neon circle" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={nightClubForm.control}
                                name={`guest_actions.${index}.energyCost` as const}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Energy cost</FormLabel>
                                    <FormControl>
                                      <Input {...field} type="number" placeholder="10" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <FormField
                              control={nightClubForm.control}
                              name={`guest_actions.${index}.description` as const}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Action description</FormLabel>
                                  <FormControl>
                                    <Textarea {...field} rows={2} placeholder="Share how this moment changes the room." />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => removeGuestAction(index)}
                              >
                                Remove action
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-base">Signature drinks</FormLabel>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => appendDrink(createDrinkField())}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" /> Add drink
                      </Button>
                    </div>
                    <FormDescription>Spotlight limited pours, seasonal mocktails, and their effects.</FormDescription>
                    {drinkMenuFields.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
                        No drinks configured yet. Add a few signature mixes to welcome guests.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {drinkMenuFields.map((fieldItem, index) => (
                          <div key={fieldItem.id} className="space-y-3 rounded-md border border-border/60 p-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <FormField
                                control={nightClubForm.control}
                                name={`drink_menu.${index}.name` as const}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Drink name</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="Neon Bloom" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={nightClubForm.control}
                                name={`drink_menu.${index}.price` as const}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Price</FormLabel>
                                    <FormControl>
                                      <Input {...field} type="number" min={0} placeholder="18" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <FormField
                              control={nightClubForm.control}
                              name={`drink_menu.${index}.effect` as const}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Effect</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="+10 morale for the crew" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => removeDrink(index)}
                              >
                                Remove drink
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-base">Resident NPCs</FormLabel>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => appendNpc(createNpcField())}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" /> Add NPC
                      </Button>
                    </div>
                    <FormDescription>Plan the staff, promoters, and characters that animate the venue.</FormDescription>
                    {npcProfileFields.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
                        No resident characters yet. Add a host, promoter, or mentor to guide players.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {npcProfileFields.map((fieldItem, index) => (
                          <div key={fieldItem.id} className="space-y-3 rounded-md border border-border/60 p-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <FormField
                                control={nightClubForm.control}
                                name={`npc_profiles.${index}.name` as const}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>NPC name</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="DJ Vega" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={nightClubForm.control}
                                name={`npc_profiles.${index}.role` as const}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="Resident DJ" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <FormField
                                control={nightClubForm.control}
                                name={`npc_profiles.${index}.personality` as const}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Personality</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="Charismatic hype leader" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={nightClubForm.control}
                                name={`npc_profiles.${index}.availability` as const}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Availability</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="Fri-Sat until close" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <FormField
                              control={nightClubForm.control}
                              name={`npc_profiles.${index}.dialogueTopics` as const}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Dialogue hooks</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      {...field}
                                      rows={2}
                                      placeholder="Merch trends, afterparty tips, collaboration rumors"
                                    />
                                  </FormControl>
                                  <FormDescription>Separate topics with commas or line breaks.</FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => removeNpc(index)}
                              >
                                Remove NPC
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold">DJ slot settings</h3>
                      <p className="text-sm text-muted-foreground">
                        Fine-tune fame requirements, payouts, set length, perks, and the released tracks DJs can spin.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={nightClubForm.control}
                        name="dj_slot_config.minimum_fame"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum fame</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" min={0} placeholder="750" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={nightClubForm.control}
                        name="dj_slot_config.payout"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>DJ payout</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" min={0} placeholder="800" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={nightClubForm.control}
                        name="dj_slot_config.set_length_minutes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Set length (minutes)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" min={0} placeholder="60" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={nightClubForm.control}
                        name="dj_slot_config.schedule"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Slot schedule</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Fridays 1-3 a.m." />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-base">Set perks</FormLabel>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => appendPerk(createPerkField())}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" /> Add perk
                        </Button>
                      </div>
                      {perkFields.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border/60 p-3 text-sm text-muted-foreground">
                          Highlight perks that make the DJ booth worth the effort, like fan buzz boosts or merch bonuses.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {perkFields.map((fieldItem, index) => (
                            <div key={fieldItem.id} className="flex items-center gap-3">
                              <FormField
                                control={nightClubForm.control}
                                name={`dj_slot_config.perks.${index}.value` as const}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormLabel className="sr-only">Perk</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="+4% night fan buzz" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => removePerk(index)}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <FormField
                      control={nightClubForm.control}
                      name="dj_slot_config.song_ids"
                      render={({ field }) => {
                        const selectedIds = field.value ?? [];
                        const missingSongIds = selectedIds.filter(
                          (songId) => !releasedSongs.some((song) => song.id === songId),
                        );

                        return (
                          <FormItem className="space-y-2">
                            <div className="space-y-1">
                              <FormLabel>DJ song library</FormLabel>
                              <FormDescription>
                                Players queue for sets using these released tracks.
                              </FormDescription>
                            </div>
                            <div className="rounded-md border border-border/60">
                              {songsLoading ? (
                                <div className="flex items-center justify-center px-4 py-6 text-sm text-muted-foreground">
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading released songs…
                                </div>
                              ) : songsError ? (
                                <div className="px-4 py-3 text-sm text-destructive">{songsError}</div>
                              ) : releasedSongs.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-muted-foreground">
                                  No released songs available yet. Add releases to unlock DJ queues.
                                </div>
                              ) : (
                                <ScrollArea className="h-56 w-full rounded-md">
                                  <div className="space-y-1 p-2">
                                    {releasedSongs.map((song) => {
                                      const checked = selectedIds.includes(song.id);
                                      return (
                                        <label
                                          key={song.id}
                                          className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
                                        >
                                          <Checkbox
                                            checked={checked}
                                            onCheckedChange={(checkedState) => {
                                              const current = new Set(selectedIds);
                                              if (checkedState === true) {
                                                current.add(song.id);
                                              } else {
                                                current.delete(song.id);
                                              }
                                              field.onChange(Array.from(current));
                                            }}
                                          />
                                          <span className="flex flex-col gap-0.5">
                                            <span className="font-medium leading-tight">{song.title}</span>
                                            {song.genre && (
                                              <span className="text-xs text-muted-foreground">{song.genre}</span>
                                            )}
                                          </span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </ScrollArea>
                              )}
                            </div>
                            {!songsLoading && !songsError && releasedSongs.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {selectedIds.length} track{selectedIds.length === 1 ? "" : "s"} selected.
                              </div>
                            )}
                            {missingSongIds.length > 0 && (
                              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                {missingSongIds.length} selected song{missingSongIds.length === 1 ? " is" : "s are"} no longer released. Refresh the library to keep DJs spinning active tracks.
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>

                  <FormField
                    control={nightClubForm.control}
                    name="live_interactions_enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border border-border/60 p-3">
                        <div className="space-y-1">
                          <FormLabel>Live interactions</FormLabel>
                          <FormDescription>
                            Enable real-time chats and matchmaking for this venue.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingClub ? "Save changes" : "Create night club"}
                    </Button>
                    {editingClub && (
                      <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                        Cancel edit
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configured night clubs</CardTitle>
              <CardDescription>
                Review nightlife venues across the world. Fame requirements scale with club quality and each slot requires released songs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading night clubs...
                </div>
              ) : loadingError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  {loadingError}
                </div>
              ) : nightClubs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                  No night clubs have been configured yet. Use the form to create one.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Club</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Fame requirement</TableHead>
                      <TableHead className="hidden xl:table-cell">Guest actions</TableHead>
                      <TableHead className="hidden lg:table-cell">Songs</TableHead>
                      <TableHead>Live</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nightClubs.map((club) => {
                      const fameRequirement = computeFameRequirement(club);
                      const interactionsEnabled = parseLiveInteractionFlag(club);
                      const songIds = extractSongIds(club.dj_slot_config);
                      const songCount = songIds.length;

                      return (
                        <TableRow key={club.id} className="align-top">
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium text-foreground">{club.name ?? "Untitled club"}</div>
                              {club.description && (
                                <p className="text-xs text-muted-foreground">{club.description}</p>
                              )}
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {club.capacity && <span>Cap {club.capacity.toLocaleString()}</span>}
                                {typeof club.cover_charge === "number" && (
                                  <span>Cover {currencyFormatter.format(club.cover_charge)}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{club.city?.name ?? "Unlinked"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{qualityLabel(club)}</Badge>
                          </TableCell>
                          <TableCell>{fameRequirement.toLocaleString()} fame</TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {Array.isArray(club.guest_actions) && club.guest_actions.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {club.guest_actions.slice(0, 4).map((action, index) => {
                                  if (typeof action === "string") {
                                    return (
                                      <Badge key={`${club.id}-action-${index}`} variant="outline">
                                        {action}
                                      </Badge>
                                    );
                                  }

                                  if (isRecord(action) && typeof action.label === "string") {
                                    return (
                                      <Badge key={`${club.id}-action-${index}`} variant="outline">
                                        {action.label}
                                      </Badge>
                                    );
                                  }

                                  return null;
                                })}
                                {club.guest_actions.length > 4 && (
                                  <Badge variant="outline">+{club.guest_actions.length - 4} more</Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {songCount > 0 ? (
                              <Badge variant="outline">{songCount} track{songCount === 1 ? "" : "s"}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Assign songs</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={interactionsEnabled ? "outline" : "destructive"}>
                              {interactionsEnabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell className="flex justify-end gap-2">
                            <Button size="icon" variant="outline" onClick={() => handleEdit(club)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleDelete(club.id)}
                              disabled={deletingClubId === club.id}
                            >
                              {deletingClubId === club.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default NightClubsAdmin;
