import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, LockOpen, Pencil, PlusCircle, Trash2 } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

const createNumberField = ({
  field,
  min,
  max,
  integer = false,
}: {
  field: string;
  min?: number;
  max?: number;
  integer?: boolean;
}) => {
  const rangeMessage = (() => {
    if (typeof min === "number" && typeof max === "number") {
      return `${field} must be between ${min} and ${max}`;
    }

    if (typeof min === "number") {
      return `${field} must be at least ${min}`;
    }

    if (typeof max === "number") {
      return `${field} cannot exceed ${max}`;
    }

    return `${field} must be a valid number`;
  })();

  return z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .refine((value) => !Number.isNaN(Number(value)), `${field} must be a number`)
    .refine((value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return false;
      if (typeof min === "number" && parsed < min) return false;
      if (typeof max === "number" && parsed > max) return false;
      if (integer && !Number.isInteger(parsed)) return false;
      return true;
    }, rangeMessage);
};

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

const citySchema = z.object({
  name: z.string().trim().min(1, "City name is required"),
  country: z.string().trim().min(1, "Country is required"),
  description: z.string().optional(),
  profile_description: z.string().optional(),
  dominant_genre: z.string().optional(),
  population: createNumberField({ field: "Population", min: 0, integer: true }),
  music_scene: createNumberField({ field: "Music scene", min: 0, max: 100, integer: true }),
  cost_of_living: createNumberField({ field: "Cost of living", min: 0, max: 100, integer: true }),
  venues: createNumberField({ field: "Venues", min: 0, integer: true }),
  local_bonus: createNumberField({ field: "Local bonus", min: 0, max: 100 }),
  busking_value: createNumberField({ field: "Busking value", min: 0, max: 100 }),
  bonuses: z.string().optional(),
  famous_resident: z.string().optional(),
  travel_hub: z.string().optional(),
  unlocked: z.boolean(),
  cultural_events: jsonArrayField("Cultural events"),
  featured_venues: jsonArrayField("Featured venues"),
  featured_studios: jsonArrayField("Featured studios"),
  transport_links: jsonArrayField("Transport links"),
});

type CityFormValues = z.infer<typeof citySchema>;

const cityDefaultValues: CityFormValues = {
  name: "",
  country: "",
  description: "",
  profile_description: "",
  dominant_genre: "",
  population: "",
  music_scene: "",
  cost_of_living: "",
  venues: "",
  local_bonus: "",
  busking_value: "",
  bonuses: "",
  famous_resident: "",
  travel_hub: "",
  unlocked: true,
  cultural_events: "[]",
  featured_venues: "[]",
  featured_studios: "[]",
  transport_links: "[]",
};

type CityRow = {
  id: string;
  name: string | null;
  country: string | null;
  description: string | null;
  profile_description: string | null;
  dominant_genre: string | null;
  population: number | null;
  music_scene: number | null;
  cost_of_living: number | null;
  venues: number | null;
  local_bonus: number | null;
  busking_value: number | null;
  bonuses: string | null;
  famous_resident: string | null;
  travel_hub: string | null;
  unlocked: boolean | null;
  cultural_events: unknown;
  featured_venues: unknown;
  featured_studios: unknown;
  transport_links: unknown;
};

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = (value: number | null) =>
  typeof value === "number" && Number.isFinite(value) ? `${value}%` : "—";

const parseJsonArray = (value: string): unknown[] => {
  if (!value || value.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error("Failed to parse JSON array", error);
  }

  return [];
};

const parseStringArray = (value: string): string[] =>
  parseJsonArray(value)
    .flatMap((entry) => {
      if (typeof entry !== "string") return [];
      const trimmed = entry.trim();
      return trimmed.length > 0 ? [trimmed] : [];
    });

const formatJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return JSON.stringify(value, null, 2);
  }

  if (typeof value === "string" && value.trim().startsWith("[")) {
    return value;
  }

  if (value == null) {
    return "[]";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    console.error("Failed to stringify JSON", error);
    return "[]";
  }
};

const sanitizeText = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildPayload = (values: CityFormValues) => ({
  name: values.name.trim(),
  country: values.country.trim(),
  description: sanitizeText(values.description),
  profile_description: sanitizeText(values.profile_description),
  dominant_genre: sanitizeText(values.dominant_genre),
  population: Number(values.population),
  music_scene: Number(values.music_scene),
  cost_of_living: Number(values.cost_of_living),
  venues: Number(values.venues),
  local_bonus: Number(values.local_bonus),
  busking_value: Number(values.busking_value),
  bonuses: sanitizeText(values.bonuses),
  famous_resident: sanitizeText(values.famous_resident),
  travel_hub: sanitizeText(values.travel_hub),
  unlocked: values.unlocked,
  cultural_events: parseStringArray(values.cultural_events),
  featured_venues: parseJsonArray(values.featured_venues),
  featured_studios: parseJsonArray(values.featured_studios),
  transport_links: parseJsonArray(values.transport_links),
});

const parseArrayCount = (value: unknown) => (Array.isArray(value) ? value.length : 0);

const useCityForm = () =>
  useForm<CityFormValues>({
    resolver: zodResolver(citySchema),
    defaultValues: cityDefaultValues,
    mode: "onBlur",
  });

const CitiesAdmin = () => {
  const { toast } = useToast();
  const [cities, setCities] = useState<CityRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCity, setEditingCity] = useState<CityRow | null>(null);
  const [deletingCityId, setDeletingCityId] = useState<string | null>(null);

  const cityForm = useCityForm();

  const fetchCities = useCallback(async () => {
    setIsLoading(true);
    setLoadingError(null);
    try {
      const { data, error } = await supabase
        .from("cities")
        .select(
          "id, name, country, description, profile_description, dominant_genre, population, music_scene, cost_of_living, venues, local_bonus, busking_value, bonuses, famous_resident, travel_hub, unlocked, cultural_events, featured_venues, featured_studios, transport_links",
        )
        .order("name", { ascending: true });

      if (error) throw error;

      setCities((data ?? []) as CityRow[]);
    } catch (error) {
      console.error("Failed to load cities", error);
      setLoadingError("We couldn't load the city list. Please try again later.");
      toast({
        variant: "destructive",
        title: "Unable to load cities",
        description: "Fetching cities failed. Please refresh the page.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCities();
  }, [fetchCities]);

  const resetForm = useCallback(() => {
    setEditingCity(null);
    cityForm.reset(cityDefaultValues);
  }, [cityForm]);

  const onSubmit = useMemo(
    () =>
      cityForm.handleSubmit(async (values) => {
        setIsSubmitting(true);
        try {
          const payload = buildPayload(values);

          if (editingCity) {
            const { error } = await supabase
              .from("cities")
              .update(payload)
              .eq("id", editingCity.id);

            if (error) throw error;

            toast({
              title: "City updated",
              description: `${payload.name} has been updated successfully.`,
            });
          } else {
            const { error } = await supabase.from("cities").insert(payload);

            if (error) throw error;

            toast({
              title: "City created",
              description: `${payload.name} has been added to the world.`,
            });
          }

          resetForm();
          await fetchCities();
        } catch (error) {
          console.error("Failed to save city", error);
          toast({
            variant: "destructive",
            title: "Unable to save city",
            description: "Please review the form inputs and try again.",
          });
        } finally {
          setIsSubmitting(false);
        }
      }),
    [cityForm, editingCity, fetchCities, resetForm, toast],
  );

  const handleEdit = (city: CityRow) => {
    setEditingCity(city);
    cityForm.reset({
      name: city.name ?? "",
      country: city.country ?? "",
      description: city.description ?? "",
      profile_description: city.profile_description ?? "",
      dominant_genre: city.dominant_genre ?? "",
      population: city.population?.toString() ?? "",
      music_scene: city.music_scene?.toString() ?? "",
      cost_of_living: city.cost_of_living?.toString() ?? "",
      venues: city.venues?.toString() ?? "",
      local_bonus: city.local_bonus?.toString() ?? "",
      busking_value: city.busking_value?.toString() ?? "",
      bonuses: city.bonuses ?? "",
      famous_resident: city.famous_resident ?? "",
      travel_hub: city.travel_hub ?? "",
      unlocked: city.unlocked ?? false,
      cultural_events: formatJson(city.cultural_events),
      featured_venues: formatJson(city.featured_venues),
      featured_studios: formatJson(city.featured_studios),
      transport_links: formatJson(city.transport_links),
    });
  };

  const handleDelete = async (city: CityRow) => {
    setDeletingCityId(city.id);
    try {
      const { error } = await supabase.from("cities").delete().eq("id", city.id);

      if (error) throw error;

      toast({
        title: "City deleted",
        description: `${city.name ?? "City"} has been removed.`,
      });

      if (editingCity?.id === city.id) {
        resetForm();
      }

      await fetchCities();
    } catch (error) {
      console.error("Failed to delete city", error);
      toast({
        variant: "destructive",
        title: "Unable to delete city",
        description: "Please try again in a moment.",
      });
    } finally {
      setDeletingCityId(null);
    }
  };

  return (
    <AdminRoute>
      <div className="container mx-auto space-y-8 px-4 py-10">
        <div className="space-y-2 text-center">
          <Badge variant="outline" className="uppercase">Admin Tool</Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">City Management</h1>
          <p className="text-muted-foreground">
            Manage the global roster of cities, including their stats, featured locations, and travel links.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] xl:grid-cols-2">
          <Card className="order-2 lg:order-1">
            <CardHeader>
              <CardTitle>City Directory</CardTitle>
              <CardDescription>Browse existing cities and edit or remove them as needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="flex min-h-[200px] items-center justify-center">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading cities...</span>
                  </div>
                </div>
              ) : loadingError ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                  {loadingError}
                </div>
              ) : cities.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No cities have been created yet. Use the form to add one.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px]">City</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead className="text-right">Population</TableHead>
                        <TableHead className="text-right">Music Scene</TableHead>
                        <TableHead className="text-right">Local Bonus</TableHead>
                        <TableHead className="text-right">Busking Value</TableHead>
                        <TableHead className="text-right">Events</TableHead>
                        <TableHead className="text-right">Venues</TableHead>
                        <TableHead className="text-right">Studios</TableHead>
                        <TableHead className="text-right">Transport</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                        <TableHead className="w-[120px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cities.map((city) => (
                        <TableRow key={city.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{city.name ?? "Unnamed city"}</div>
                              {city.dominant_genre && (
                                <div className="text-xs text-muted-foreground">Genre: {city.dominant_genre}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{city.country ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            {typeof city.population === "number" ? numberFormatter.format(city.population) : "—"}
                          </TableCell>
                          <TableCell className="text-right">{percentFormatter(city.music_scene)}</TableCell>
                          <TableCell className="text-right">{percentFormatter(city.local_bonus)}</TableCell>
                          <TableCell className="text-right">{percentFormatter(city.busking_value)}</TableCell>
                          <TableCell className="text-right">{parseArrayCount(city.cultural_events)}</TableCell>
                          <TableCell className="text-right">{parseArrayCount(city.featured_venues)}</TableCell>
                          <TableCell className="text-right">{parseArrayCount(city.featured_studios)}</TableCell>
                          <TableCell className="text-right">{parseArrayCount(city.transport_links)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 text-sm">
                              {city.unlocked ? (
                                <>
                                  <LockOpen className="h-4 w-4 text-emerald-500" />
                                  <span className="text-emerald-600 dark:text-emerald-400">Unlocked</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="h-4 w-4 text-amber-500" />
                                  <span className="text-amber-600 dark:text-amber-400">Locked</span>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(city)}
                                aria-label={`Edit ${city.name ?? "city"}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(city)}
                                aria-label={`Delete ${city.name ?? "city"}`}
                                disabled={deletingCityId === city.id}
                              >
                                {deletingCityId === city.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="order-1 lg:order-2">
            <CardHeader>
              <CardTitle>{editingCity ? "Edit city" : "Add a new city"}</CardTitle>
              <CardDescription>
                {editingCity
                  ? "Update city stats, descriptions, or featured data to keep the world fresh."
                  : "Create a new city profile with stats, cultural details, and travel information."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...cityForm}>
                <form className="space-y-6" onSubmit={onSubmit}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={cityForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City name</FormLabel>
                          <FormControl>
                            <Input placeholder="Neo Sound City" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <FormControl>
                            <Input placeholder="United States" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="dominant_genre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dominant genre</FormLabel>
                          <FormControl>
                            <Input placeholder="Indie rock" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="travel_hub"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary travel hub</FormLabel>
                          <FormControl>
                            <Input placeholder="Kings Cross Station" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="famous_resident"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Famous resident</FormLabel>
                          <FormControl>
                            <Input placeholder="Lyra Steel" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="population"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Population</FormLabel>
                          <FormControl>
                            <Input type="number" inputMode="numeric" placeholder="1200000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="music_scene"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Music scene strength (0-100)</FormLabel>
                          <FormControl>
                            <Input type="number" inputMode="numeric" placeholder="85" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="cost_of_living"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost of living (0-100)</FormLabel>
                          <FormControl>
                            <Input type="number" inputMode="numeric" placeholder="60" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="venues"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Venue count</FormLabel>
                          <FormControl>
                            <Input type="number" inputMode="numeric" placeholder="24" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="local_bonus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Local bonus (0-100)</FormLabel>
                          <FormControl>
                            <Input type="number" inputMode="numeric" placeholder="25" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="busking_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Busking value (0-100)</FormLabel>
                          <FormControl>
                            <Input type="number" inputMode="numeric" placeholder="30" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="bonuses"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Bonuses</FormLabel>
                          <FormControl>
                            <Textarea rows={2} placeholder="+6% fan growth after sell-out runs" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={cityForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Overview description</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="A coastal hub buzzing with creativity." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={cityForm.control}
                    name="profile_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profile description</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Players discover diverse genres and collaborative venues." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <FormField
                      control={cityForm.control}
                      name="unlocked"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between gap-4">
                            <div className="space-y-1">
                              <FormLabel>Unlocked</FormLabel>
                              <FormDescription>
                                Locked cities are hidden from players until live ops unlock them.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(checked) => field.onChange(checked)}
                                aria-label="Toggle unlocked"
                              />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="cultural_events"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cultural events (JSON array)</FormLabel>
                          <FormControl>
                            <Textarea rows={3} placeholder='["Jazz Festival", "Indie Week"]' {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="featured_venues"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Featured venues (JSON array)</FormLabel>
                          <FormControl>
                            <Textarea rows={3} placeholder='[{"name": "Aurora Hall", "highlight": "Iconic stage"}]' {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="featured_studios"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Featured studios (JSON array)</FormLabel>
                          <FormControl>
                            <Textarea rows={3} placeholder='[{"name": "Solaris Sound", "rating": 92}]' {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={cityForm.control}
                      name="transport_links"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Transport links (JSON array)</FormLabel>
                          <FormControl>
                            <Textarea rows={3} placeholder='[{"type": "rail", "name": "Central Station"}]' {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : editingCity ? (
                        <>
                          <Pencil className="mr-2 h-4 w-4" />
                          Update city
                        </>
                      ) : (
                        <>
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Create city
                        </>
                      )}
                    </Button>
                    {editingCity ? (
                      <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                        Cancel editing
                      </Button>
                    ) : null}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default CitiesAdmin;
