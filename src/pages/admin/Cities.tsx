import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, RefreshCcw, Trash2 } from "lucide-react";
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
import type { Database, Json } from "@/lib/supabase-types";

import {
  formatCommaSeparatedList,
  formatNumberInput,
  parseCommaSeparatedInput,
  parseNumberInput,
} from "./shared";

const createNumericFieldSchema = ({
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
  let schema = z
    .string()
    .trim()
    .refine((value) => value === "" || !Number.isNaN(Number(value)), `${field} must be a number`);

  if (typeof min === "number") {
    schema = schema.refine(
      (value) => value === "" || Number(value) >= min,
      `${field} must be at least ${min}`,
    );
  }

  if (typeof max === "number") {
    schema = schema.refine(
      (value) => value === "" || Number(value) <= max,
      `${field} cannot exceed ${max}`,
    );
  }

  if (integer) {
    schema = schema.refine(
      (value) => value === "" || Number.isInteger(Number(value)),
      `${field} must be a whole number`,
    );
  }

  return schema.default("");
};

const createJsonArrayFieldSchema = ({ field }: { field: string }) =>
  z
    .string()
    .trim()
    .refine((value) => {
      if (!value) {
        return true;
      }

      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed);
      } catch (error) {
        console.error(`Failed to parse ${field} JSON input`, error);
        return false;
      }
    }, `${field} must be a valid JSON array`)
    .default("");

const parseJsonArrayInput = (value: string): Json => {
  const trimmed = value.trim();
  if (!trimmed) {
    return [] as Json;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? (parsed as Json) : ([] as Json);
  } catch (error) {
    console.error("Failed to parse JSON array input", error);
    return [] as Json;
  }
};

const formatJsonArrayInput = (value: Json | null | undefined): string => {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    console.error("Failed to format JSON array input", error);
    return "";
  }
};

const normalizeOptionalText = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const citySchema = z.object({
  name: z.string().trim().min(1, "City name is required"),
  country: z.string().trim().min(1, "Country is required"),
  dominantGenre: z.string().trim().default(""),
  description: z.string().trim().default(""),
  profileDescription: z.string().trim().default(""),
  bonuses: z.string().trim().default(""),
  unlocked: z.boolean().default(false),
  population: createNumericFieldSchema({ field: "Population", min: 0, integer: true }),
  musicScene: createNumericFieldSchema({ field: "Music scene score", min: 0, max: 100 }),
  localBonus: createNumericFieldSchema({ field: "Local bonus", min: 0 }),
  buskingValue: createNumericFieldSchema({ field: "Busking value", min: 0 }),
  costOfLiving: createNumericFieldSchema({ field: "Cost of living index", min: 0 }),
  venues: createNumericFieldSchema({ field: "Venue count", min: 0, integer: true }),
  culturalEvents: z.string().trim().default(""),
  districts: createJsonArrayFieldSchema({ field: "Districts" }),
  travelNodes: createJsonArrayFieldSchema({ field: "Travel nodes" }),
  featuredVenues: createJsonArrayFieldSchema({ field: "Featured venues" }),
  featuredStudios: createJsonArrayFieldSchema({ field: "Featured studios" }),
  transportLinks: createJsonArrayFieldSchema({ field: "Transport links" }),
  famousResident: z.string().trim().default(""),
  travelHub: z.string().trim().default(""),
  latitude: createNumericFieldSchema({ field: "Latitude", min: -90, max: 90 }),
  longitude: createNumericFieldSchema({ field: "Longitude", min: -180, max: 180 }),
});

type CityFormValues = z.infer<typeof citySchema>;
type CityRow = Database["public"]["Tables"]["cities"]["Row"];
type CityInsert = Database["public"]["Tables"]["cities"]["Insert"];
type CityUpdate = Database["public"]["Tables"]["cities"]["Update"];

const cityDefaultValues: CityFormValues = {
  name: "",
  country: "",
  dominantGenre: "",
  description: "",
  profileDescription: "",
  bonuses: "",
  unlocked: false,
  population: "",
  musicScene: "",
  localBonus: "",
  buskingValue: "",
  costOfLiving: "",
  venues: "",
  culturalEvents: "",
  districts: "",
  travelNodes: "",
  featuredVenues: "",
  featuredStudios: "",
  transportLinks: "",
  famousResident: "",
  travelHub: "",
  latitude: "",
  longitude: "",
};

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export default function Cities() {
  const { toast } = useToast();
  const [cities, setCities] = useState<CityRow[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isSubmittingCity, setIsSubmittingCity] = useState(false);
  const [editingCity, setEditingCity] = useState<CityRow | null>(null);
  const [deletingCityId, setDeletingCityId] = useState<string | null>(null);

  const cityForm = useForm<CityFormValues>({
    resolver: zodResolver(citySchema),
    defaultValues: cityDefaultValues,
  });

  const formTitle = useMemo(
    () => (editingCity ? "Update City" : "Create City"),
    [editingCity],
  );

  const formDescription = useMemo(
    () =>
      editingCity
        ? "Edit the selected city's travel and culture profile."
        : "Add a new city and define its travel, music, and cultural attributes.",
    [editingCity],
  );

  const hasCities = cities.length > 0;

  const handleFetchCities = useCallback(async () => {
    setIsLoadingCities(true);
    try {
      const { data, error } = await supabase.from("cities").select("*").order("name", { ascending: true });

      if (error) throw error;

      setCities((data as CityRow[] | null) ?? []);
    } catch (error) {
      console.error("Failed to load cities", error);
      toast({
        variant: "destructive",
        title: "Unable to load cities",
        description: "We couldn't retrieve the cities list. Please try again later.",
      });
    } finally {
      setIsLoadingCities(false);
    }
  }, [toast]);

  useEffect(() => {
    void handleFetchCities();
  }, [handleFetchCities]);

  const resetCityForm = useCallback(() => {
    cityForm.reset({ ...cityDefaultValues });
    setEditingCity(null);
  }, [cityForm]);

  const handleSubmitCity = useCallback(
    async (values: CityFormValues) => {
      setIsSubmittingCity(true);
      const isEditing = Boolean(editingCity);
      const editingId = editingCity?.id;

      try {
        const parsedPopulation = parseNumberInput(values.population);
        const parsedMusicScene = parseNumberInput(values.musicScene);
        const parsedLocalBonus = parseNumberInput(values.localBonus);
        const parsedBuskingValue = parseNumberInput(values.buskingValue);
        const parsedCostOfLiving = parseNumberInput(values.costOfLiving);
        const parsedVenues = parseNumberInput(values.venues);
        const parsedLatitude = parseNumberInput(values.latitude);
        const parsedLongitude = parseNumberInput(values.longitude);
        const culturalEvents = parseCommaSeparatedInput(values.culturalEvents);
        const districts = parseJsonArrayInput(values.districts);
        const travelNodes = parseJsonArrayInput(values.travelNodes);
        const featuredVenues = parseJsonArrayInput(values.featuredVenues);
        const featuredStudios = parseJsonArrayInput(values.featuredStudios);
        const transportLinks = parseJsonArrayInput(values.transportLinks);

        const payload: CityInsert = {
          name: values.name.trim(),
          country: values.country.trim(),
          dominant_genre: values.dominantGenre.trim() || null,
          description: normalizeOptionalText(values.description),
          profile_description: normalizeOptionalText(values.profileDescription),
          bonuses: normalizeOptionalText(values.bonuses),
          unlocked: values.unlocked,
          population: parsedPopulation,
          music_scene: parsedMusicScene,
          local_bonus: parsedLocalBonus,
          busking_value: typeof parsedBuskingValue === "number" ? parsedBuskingValue : undefined,
          cost_of_living: parsedCostOfLiving,
          venues: parsedVenues,
          cultural_events: culturalEvents.length > 0 ? culturalEvents : null,
          districts,
          travel_nodes: travelNodes,
          featured_venues: featuredVenues,
          featured_studios: featuredStudios,
          transport_links: transportLinks,
          famous_resident: normalizeOptionalText(values.famousResident),
          travel_hub: normalizeOptionalText(values.travelHub),
          latitude: parsedLatitude,
          longitude: parsedLongitude,
        };

        if (isEditing && editingId) {
          const updatePayload: CityUpdate = { ...payload };
          const { error } = await supabase.from("cities").update(updatePayload).eq("id", editingId);

          if (error) throw error;

          toast({
            title: "City updated",
            description: `${values.name} has been saved.`,
          });
        } else {
          const { error } = await supabase.from("cities").insert(payload);

          if (error) throw error;

          toast({
            title: "City created",
            description: `${values.name} is now available in the world.`,
          });
        }

        resetCityForm();
        await handleFetchCities();
      } catch (error) {
        console.error("Failed to save city", error);
        toast({
          variant: "destructive",
          title: "Save failed",
          description: "We couldn't save the city. Please review the details and try again.",
        });
      } finally {
        setIsSubmittingCity(false);
      }
    },
    [editingCity, handleFetchCities, resetCityForm, toast],
  );

  const handleEditCity = useCallback(
    (city: CityRow) => {
      setEditingCity(city);
      cityForm.reset({
        name: city.name ?? "",
        country: city.country ?? "",
        dominantGenre: city.dominant_genre ?? "",
        description: city.description ?? "",
        profileDescription: city.profile_description ?? "",
        bonuses: city.bonuses ?? "",
        unlocked: Boolean(city.unlocked),
        population: formatNumberInput(city.population),
        musicScene: formatNumberInput(city.music_scene),
        localBonus: formatNumberInput(city.local_bonus),
        buskingValue: formatNumberInput(city.busking_value),
        costOfLiving: formatNumberInput(city.cost_of_living),
        venues: formatNumberInput(city.venues),
        culturalEvents: formatCommaSeparatedList(city.cultural_events),
        districts: formatJsonArrayInput(city.districts),
        travelNodes: formatJsonArrayInput(city.travel_nodes),
        featuredVenues: formatJsonArrayInput(city.featured_venues),
        featuredStudios: formatJsonArrayInput(city.featured_studios),
        transportLinks: formatJsonArrayInput(city.transport_links),
        famousResident: city.famous_resident ?? "",
        travelHub: city.travel_hub ?? "",
        latitude: formatNumberInput(city.latitude),
        longitude: formatNumberInput(city.longitude),
      });
    },
    [cityForm],
  );

  const handleDeleteCity = useCallback(
    async (id: string, name: string) => {
      setDeletingCityId(id);

      try {
        const { error } = await supabase.from("cities").delete().eq("id", id);

        if (error) throw error;

        if (editingCity?.id === id) {
          resetCityForm();
        }

        await handleFetchCities();
        toast({
          title: "City deleted",
          description: `${name || "The selected city"} has been removed from the world roster.`,
        });
      } catch (error) {
        console.error("Failed to delete city", error);
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: "We couldn't remove the city. Please try again.",
        });
      } finally {
        setDeletingCityId(null);
      }
    },
    [editingCity?.id, handleFetchCities, resetCityForm, toast],
  );

  return (
    <AdminRoute>
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Cities</h1>
          <p className="text-muted-foreground">
            Curate the cities players can travel to, including cultural flavor and gameplay modifiers.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xl">
              {formTitle}
              {editingCity ? <Badge variant="secondary">Editing</Badge> : null}
            </CardTitle>
            <CardDescription>{formDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...cityForm}>
              <form onSubmit={cityForm.handleSubmit(handleSubmitCity)} className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={cityForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>City name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter city name" autoComplete="address-level2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter country" autoComplete="country-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="dominantGenre"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Dominant genre</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Electronic, Indie Rock" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Short description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Narrative hook shown on the world map"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="profileDescription"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Profile description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Long-form lore used on the city profile page"
                          rows={3}
                          {...field}
                        />
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
                      <FormLabel>Gameplay bonuses</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. +10% streaming buzz during night gigs"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="unlocked"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <div className="flex items-start justify-between gap-4 rounded-md border p-4">
                        <div className="space-y-1">
                          <FormLabel className="text-base">Unlocked for players</FormLabel>
                          <FormDescription>
                            Locked cities remain hidden until progression or events unlock them.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Toggle city unlock" />
                        </FormControl>
                      </div>
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
                        <Input type="number" inputMode="numeric" min={0} step={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="musicScene"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Music scene score (0-100)</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="numeric" min={0} max={100} step={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="localBonus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Local bonus multiplier</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="decimal" min={0} step="0.1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="buskingValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Busking value multiplier</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="decimal" min={0} step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="costOfLiving"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost of living index</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="numeric" min={0} step={1} {...field} />
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
                        <Input type="number" inputMode="numeric" min={0} step={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="decimal" min={-90} max={90} step="0.0001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="decimal" min={-180} max={180} step="0.0001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="famousResident"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Famous resident</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional lore character" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="travelHub"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary travel hub</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Solace Union Station" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="culturalEvents"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Cultural events</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Comma-separated list such as Summer Jam, Midnight Parade"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="districts"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Districts (JSON)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='[{"name":"District","description":"What makes it unique"}]'
                          rows={5}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Provide a JSON array describing the city districts.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="travelNodes"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Travel nodes (JSON)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='[{"mode":"tram","name":"City Loop","description":"Route details"}]'
                          rows={5}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Structured travel options used for route planning.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="featuredVenues"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Featured venues (JSON)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='[{"name":"Venue","highlights":["Stage"],"vibe":"Atmosphere"}]'
                          rows={5}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Highlight signature venues in JSON format.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="featuredStudios"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Featured studios (JSON)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='[{"name":"Studio","perks":["Analog gear"],"booking":"Tips"}]'
                          rows={5}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>List notable studios players can discover.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={cityForm.control}
                  name="transportLinks"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Transport links (JSON)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='[{"mode":"ferry","name":"Harbor Line","frequency":"Every 10 minutes"}]'
                          rows={5}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Detailed transport entries surfaced on the city page.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="md:col-span-2 flex items-center justify-end gap-2">
                  {editingCity ? (
                    <Button type="button" variant="outline" onClick={resetCityForm} disabled={isSubmittingCity}>
                      Reset
                    </Button>
                  ) : null}
                  <Button type="submit" disabled={isSubmittingCity}>
                    {isSubmittingCity ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                      </>
                    ) : (
                      formTitle
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col gap-2 text-xl sm:flex-row sm:items-center sm:justify-between">
              <span>Cities</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void handleFetchCities()}
                disabled={isLoadingCities}
              >
                <RefreshCcw className={`h-4 w-4 ${isLoadingCities ? "animate-spin" : ""}`} />
                <span className="sr-only">Refresh cities</span>
              </Button>
            </CardTitle>
            <CardDescription>Review, edit, or remove cities from the travel roster.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {hasCities
                ? `${cities.length.toLocaleString()} cities available`
                : "No cities have been defined yet. Create one using the form above."}
            </div>

            {isLoadingCities ? (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading cities...
              </div>
            ) : !hasCities ? null : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>City</TableHead>
                    <TableHead className="hidden sm:table-cell">Population</TableHead>
                    <TableHead className="hidden md:table-cell">Music scene</TableHead>
                    <TableHead className="hidden lg:table-cell">Local bonus</TableHead>
                    <TableHead className="hidden lg:table-cell">Cost of living</TableHead>
                    <TableHead className="hidden md:table-cell">Venues</TableHead>
                    <TableHead className="hidden xl:table-cell">Cultural events</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cities.map((city) => (
                    <TableRow key={city.id}>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{city.name}</span>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{city.country}</span>
                            {city.dominant_genre ? (
                              <Badge variant="secondary" className="w-fit">
                                {city.dominant_genre}
                              </Badge>
                            ) : null}
                            {typeof city.unlocked === "boolean" ? (
                              <Badge
                                variant={city.unlocked ? "default" : "outline"}
                                className="w-fit"
                              >
                                {city.unlocked ? "Unlocked" : "Locked"}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell align-top">
                        {typeof city.population === "number" && Number.isFinite(city.population)
                          ? numberFormatter.format(city.population)
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell align-top">
                        {typeof city.music_scene === "number" && Number.isFinite(city.music_scene)
                          ? city.music_scene
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell align-top">
                        {typeof city.local_bonus === "number" && Number.isFinite(city.local_bonus)
                          ? decimalFormatter.format(city.local_bonus)
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell align-top">
                        {typeof city.cost_of_living === "number" && Number.isFinite(city.cost_of_living)
                          ? numberFormatter.format(city.cost_of_living)
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell align-top">
                        {typeof city.venues === "number" && Number.isFinite(city.venues)
                          ? numberFormatter.format(city.venues)
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell align-top">
                        {Array.isArray(city.cultural_events) && city.cultural_events.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {city.cultural_events.map((event) => (
                              <Badge key={event} variant="outline">
                                {event}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleEditCity(city)}
                          title="Edit city"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDeleteCity(city.id, city.name)}
                          disabled={deletingCityId === city.id}
                          title="Delete city"
                        >
                          {deletingCityId === city.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
}
