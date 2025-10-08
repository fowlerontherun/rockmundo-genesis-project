import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
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
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

import { currencyFormatter, formatNumberInput, parseNumberInput } from "./shared";

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

const jsonArrayField = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => {
      if (!value) return true;
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed);
      } catch (error) {
        console.error(`Invalid JSON for ${label}`, error);
        return false;
      }
    }, `${label} must be a valid JSON array`);

const jsonObjectField = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => {
      if (!value) return true;
      try {
        const parsed = JSON.parse(value);
        return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
      } catch (error) {
        console.error(`Invalid JSON for ${label}`, error);
        return false;
      }
    }, `${label} must be a valid JSON object`);

const nightClubSchema = z.object({
  city_id: z.string().trim().min(1, "City is required"),
  name: z.string().trim().min(1, "Club name is required"),
  description: z.string().trim().optional(),
  quality_level: createQualityLevelField(),
  capacity: optionalNumberField("Capacity"),
  cover_charge: optionalNumberField("Cover charge"),
  guest_actions: jsonArrayField("Guest actions"),
  drink_menu: jsonArrayField("Drink menu"),
  npc_profiles: jsonArrayField("NPC profiles"),
  dj_slot_config: jsonObjectField("DJ slot config"),
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

const defaultDjSlotConfig = JSON.stringify(
  {
    minimum_fame: 750,
    payout: 800,
    set_length_minutes: 60,
    perks: ["+4% night fan buzz", "Audience energy boost"],
  },
  null,
  2,
);

const nightClubDefaultValues: NightClubFormValues = {
  city_id: "",
  name: "",
  description: "",
  quality_level: "3",
  capacity: "",
  cover_charge: "",
  guest_actions: "[]",
  drink_menu: "[]",
  npc_profiles: "[]",
  dj_slot_config: defaultDjSlotConfig,
  live_interactions_enabled: true,
};

const formatJsonArray = (value: unknown[] | null | undefined): string => {
  if (!Array.isArray(value) || value.length === 0) {
    return "[]";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    console.error("Failed to format JSON array", error);
    return "[]";
  }
};

const formatJsonObject = (value: Record<string, unknown> | null | undefined): string => {
  if (!value || typeof value !== "object") {
    return defaultDjSlotConfig;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    console.error("Failed to format JSON object", error);
    return defaultDjSlotConfig;
  }
};

const parseJsonArrayInput = (value: string): unknown[] => {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to parse JSON array input", error);
    return [];
  }
};

const parseJsonObjectInput = (value: string): Record<string, unknown> | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.error("Failed to parse JSON object input", error);
  }
  return null;
};

const computeFameRequirement = (club: NightClubRow): number => {
  const quality = typeof club.quality_level === "number" && Number.isFinite(club.quality_level)
    ? Math.max(1, Math.min(5, Math.round(club.quality_level)))
    : 1;

  const fromConfig = club.dj_slot_config?.minimum_fame ?? club.dj_slot_config?.fame_requirement;
  if (typeof fromConfig === "number" && Number.isFinite(fromConfig)) {
    return fromConfig;
  }

  return quality * 250;
};

const parseLiveInteractionFlag = (club: NightClubRow): boolean => {
  const value = club.metadata?.live_interactions_enabled ?? club.metadata?.liveInteractionsEnabled;
  return typeof value === "boolean" ? value : true;
};

const NightClubsAdmin = () => {
  const { toast } = useToast();
  const [cities, setCities] = useState<CityOption[]>([]);
  const [nightClubs, setNightClubs] = useState<NightClubRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingClub, setEditingClub] = useState<NightClubRow | null>(null);
  const [deletingClubId, setDeletingClubId] = useState<string | null>(null);

  const nightClubForm = useForm<NightClubFormValues>({
    resolver: zodResolver(nightClubSchema),
    defaultValues: nightClubDefaultValues,
    mode: "onBlur",
  });

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
      .from("city_night_clubs")
      .select("*, city:cities(name)")
      .order("quality_level", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch night clubs", error);
      setLoadingError("Unable to load night clubs. Ensure the migration has been applied.");
      setIsLoading(false);
      return;
    }

    setNightClubs((data ?? []) as NightClubRow[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchCities();
    void fetchNightClubs();
  }, [fetchCities, fetchNightClubs]);

  const resetForm = useCallback(() => {
    setEditingClub(null);
    nightClubForm.reset(nightClubDefaultValues);
  }, [nightClubForm]);

  const buildPayload = useCallback(
    (values: NightClubFormValues): Record<string, unknown> => {
      const metadataBase = editingClub?.metadata && typeof editingClub.metadata === "object"
        ? { ...editingClub.metadata }
        : {};

      metadataBase.live_interactions_enabled = values.live_interactions_enabled;

      return {
        city_id: values.city_id,
        name: values.name.trim(),
        description: values.description?.trim() ? values.description.trim() : null,
        quality_level: Number(values.quality_level),
        capacity: parseNumberInput(values.capacity ?? ""),
        cover_charge: parseNumberInput(values.cover_charge ?? ""),
        guest_actions: parseJsonArrayInput(values.guest_actions),
        drink_menu: parseJsonArrayInput(values.drink_menu),
        npc_profiles: parseJsonArrayInput(values.npc_profiles),
        dj_slot_config: parseJsonObjectInput(values.dj_slot_config) ?? {},
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
      nightClubForm.reset({
        city_id: club.city_id,
        name: club.name ?? "",
        description: club.description ?? "",
        quality_level: club.quality_level ? `${club.quality_level}` : "1",
        capacity: formatNumberInput(club.capacity),
        cover_charge: formatNumberInput(club.cover_charge),
        guest_actions: formatJsonArray(club.guest_actions),
        drink_menu: formatJsonArray(club.drink_menu),
        npc_profiles: formatJsonArray(club.npc_profiles),
        dj_slot_config: formatJsonObject(club.dj_slot_config),
        live_interactions_enabled: parseLiveInteractionFlag(club),
      });
    },
    [nightClubForm],
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
    [editingClub?.id, fetchNightClubs, resetForm, toast],
  );

  const qualityLabel = useCallback((club: NightClubRow) => {
    if (typeof club.quality_level !== "number") {
      return "Tier 1";
    }
    const tier = Math.max(1, Math.min(5, Math.round(club.quality_level)));
    return QUALITY_LABELS[tier] ?? `Tier ${tier}`;
  }, []);

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
                            <Input {...field} type="number" min={0} placeholder="350" />
                          </FormControl>
                          <FormDescription>Optional. Leave blank for unknown capacity.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={nightClubForm.control}
                      name="cover_charge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cover charge (USD)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" min={0} step="0.01" placeholder="25" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={nightClubForm.control}
                    name="guest_actions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guest actions (JSON array)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder='[{"label":"Buy signature drink","description":"Boosts social energy"}]'
                          />
                        </FormControl>
                        <FormDescription>Configure activities available to visiting players.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={nightClubForm.control}
                    name="drink_menu"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Drink menu (JSON array)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder='[{"name":"Neon Bloom","price":18,"effect":"+10 morale"}]'
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={nightClubForm.control}
                    name="npc_profiles"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NPC roster (JSON array)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            placeholder='[{"name":"DJ Vega","role":"Resident DJ","personality":"Charismatic"}]'
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={nightClubForm.control}
                    name="dj_slot_config"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DJ slot configuration (JSON object)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={5}
                            placeholder='{"minimum_fame": 750, "payout": 800, "set_length_minutes": 60}'
                          />
                        </FormControl>
                        <FormDescription>
                          Define fame requirements, payouts, set length, and optional perks.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                Review nightlife venues across the world. Fame requirements scale with club quality.
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
                      <TableHead>Live</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nightClubs.map((club) => {
                      const fameRequirement = computeFameRequirement(club);
                      const interactionsEnabled = parseLiveInteractionFlag(club);

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

                                  if (action && typeof action === "object" && "label" in action && typeof action.label === "string") {
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
