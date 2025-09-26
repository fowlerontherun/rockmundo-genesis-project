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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
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
  dominant_genre: z.string().optional(),
  population: createNumberField({ field: "Population", min: 0, integer: true }),
  music_scene: createNumberField({ field: "Music scene", min: 0, max: 100, integer: true }),
  cost_of_living: createNumberField({ field: "Cost of living", min: 0, max: 100, integer: true }),
  local_bonus: createNumberField({ field: "Local bonus", min: 0, max: 100, integer: true }),
  venues: createNumberField({ field: "Venues", min: 0, integer: true }),
  cultural_events: jsonArrayField("Cultural events"),
});

type CityFormValues = z.infer<typeof citySchema>;

const cityDefaultValues: CityFormValues = {
  name: "",
  country: "",
  dominant_genre: "",
  population: "",
  music_scene: "",
  cost_of_living: "",
  local_bonus: "",
  venues: "",
  cultural_events: "[]",
};

type CityRow = {
  id: string;
  name: string | null;
  country: string | null;
  dominant_genre: string | null;
  population: number | null;
  music_scene: number | null;
  cost_of_living: number | null;
  venues: number | null;
  local_bonus: number | null;
  cultural_events: string[] | null;
  created_at: string | null;
  updated_at: string | null;
};

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = (value: number | null) =>
  typeof value === "number" && Number.isFinite(value) ? `${value}%` : "—";

const parseStringArray = (value: string): string[] => {
  if (!value || value.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
  } catch (error) {
    console.error("Failed to parse string array", error);
    return [];
  }
};

const formatStringArray = (value: string[] | null | undefined): string => {
  if (!Array.isArray(value) || value.length === 0) {
    return "[]";
  }

  return JSON.stringify(value, null, 2);
};

const toNullableString = (value?: string | null) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildPayload = (values: CityFormValues) => ({
  name: values.name.trim(),
  country: values.country.trim(),
  dominant_genre: toNullableString(values.dominant_genre),
  population: Number(values.population),
  music_scene: Number(values.music_scene),
  cost_of_living: Number(values.cost_of_living),
  local_bonus: Number(values.local_bonus),
  venues: Number(values.venues),
  cultural_events: parseStringArray(values.cultural_events),
});

const parseArrayCount = (value: string[] | null | undefined) => (Array.isArray(value) ? value.length : 0);

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
          "id, name, country, dominant_genre, population, music_scene, cost_of_living, local_bonus, venues, cultural_events, created_at, updated_at",
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
      dominant_genre: city.dominant_genre ?? "",
      population: city.population?.toString() ?? "",
      music_scene: city.music_scene?.toString() ?? "",
      cost_of_living: city.cost_of_living?.toString() ?? "",
      local_bonus: city.local_bonus?.toString() ?? "",
      venues: city.venues?.toString() ?? "",
      cultural_events: formatStringArray(city.cultural_events),
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
            Manage the global roster of cities, keep their core stats up to date, and highlight cultural events.
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
                        <TableHead>Genre</TableHead>
                        <TableHead className="text-right">Population</TableHead>
                        <TableHead className="text-right">Music Scene</TableHead>
                        <TableHead className="text-right">Cost of Living</TableHead>
                        <TableHead className="text-right">Local Bonus</TableHead>
                        <TableHead className="text-right">Venues</TableHead>
                        <TableHead className="text-right">Events</TableHead>
                        <TableHead className="w-[120px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cities.map((city) => (
                        <TableRow key={city.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{city.name ?? "Unnamed city"}</div>
                            </div>
                          </TableCell>
                          <TableCell>{city.country ?? "—"}</TableCell>
                          <TableCell>{city.dominant_genre ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            {typeof city.population === "number" ? numberFormatter.format(city.population) : "—"}
                          </TableCell>
                          <TableCell className="text-right">{percentFormatter(city.music_scene)}</TableCell>
                          <TableCell className="text-right">{percentFormatter(city.cost_of_living)}</TableCell>
                          <TableCell className="text-right">{percentFormatter(city.local_bonus)}</TableCell>
                          <TableCell className="text-right">
                            {typeof city.venues === "number" ? numberFormatter.format(city.venues) : "—"}
                          </TableCell>
                          <TableCell className="text-right">{parseArrayCount(city.cultural_events)}</TableCell>
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
                  ? "Update core city stats and cultural events to keep the world fresh."
                  : "Create a new city profile with stats and cultural highlights."}
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
                  </div>

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
