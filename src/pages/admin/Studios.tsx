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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const buildRangeMessage = () => {
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
  };

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
    }, buildRangeMessage());
};

const studioSchema = z.object({
  name: z.string().trim().min(1, "Studio name is required"),
  cityId: z.string().min(1, "City is required"),
  quality: createNumberField({ field: "Quality", min: 1, max: 100, integer: true }),
  engineerRating: createNumberField({ field: "Engineer rating", min: 1, max: 100, integer: true }),
  equipmentRating: createNumberField({ field: "Equipment rating", min: 1, max: 100, integer: true }),
  costPerDay: createNumberField({ field: "Cost per day", min: 0 }),
});

const studioDefaultValues = {
  name: "",
  cityId: "",
  quality: "",
  engineerRating: "",
  equipmentRating: "",
  costPerDay: "",
};

type StudioFormValues = z.infer<typeof studioSchema>;

type CityOption = {
  id: string;
  name: string;
};

type StudioRow = {
  id: string;
  name: string;
  cityId: string | null;
  cityName: string;
  quality: number | null;
  engineerRating: number | null;
  equipmentRating: number | null;
  costPerDay: number | null;
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const ratingFormatter = (value: number | null) =>
  typeof value === "number" && Number.isFinite(value) ? `${value}/100` : "—";

export default function Studios() {
  const { toast } = useToast();
  const [cities, setCities] = useState<CityOption[]>([]);
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingStudios, setIsLoadingStudios] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingStudio, setEditingStudio] = useState<StudioRow | null>(null);
  const [deletingStudioId, setDeletingStudioId] = useState<string | null>(null);

  const studioForm = useForm<StudioFormValues>({
    resolver: zodResolver(studioSchema),
    defaultValues: studioDefaultValues,
  });

  const baseEfficiencyNote = useMemo(
    () =>
      "Base efficiency is derived from the average of the quality, engineer, and equipment ratings.",
    [],
  );

  const fetchCities = useCallback(async () => {
    setIsLoadingCities(true);
    try {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;

      const options: CityOption[] = (data ?? []).map((city: { id: string; name: string | null }) => ({
        id: city.id,
        name: city.name ?? "Unnamed city",
      }));

      setCities(options);
    } catch (error) {
      console.error("Failed to load cities", error);
      toast({
        variant: "destructive",
        title: "Unable to load cities",
        description: "We couldn't fetch the city list. Please try again later.",
      });
    } finally {
      setIsLoadingCities(false);
    }
  }, [toast]);

  const fetchStudios = useCallback(async () => {
    setIsLoadingStudios(true);
    try {
      const { data, error } = await supabase
        .from("studios")
        .select("id, name, city_id, quality, cost_per_day, engineer_rating, equipment_rating, cities(name)")
        .order("name", { ascending: true });

      if (error) throw error;

      const rows: StudioRow[] = (data ?? []).map(
        (
          studio: {
            id: string;
            name: string | null;
            city_id: string | null;
            quality: number | null;
            cost_per_day: number | null;
            engineer_rating: number | null;
            equipment_rating: number | null;
            cities?: { name?: string | null } | null;
          },
        ) => ({
          id: studio.id,
          name: studio.name ?? "Untitled Studio",
          cityId: studio.city_id,
          cityName: studio.cities?.name ?? "Unlinked city",
          quality: studio.quality,
          engineerRating: studio.engineer_rating,
          equipmentRating: studio.equipment_rating,
          costPerDay: studio.cost_per_day,
        }),
      );

      setStudios(rows);
    } catch (error) {
      console.error("Failed to load studios", error);
      toast({
        variant: "destructive",
        title: "Unable to load studios",
        description: "We couldn't retrieve the studios list. Please try again later.",
      });
    } finally {
      setIsLoadingStudios(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchCities();
    void fetchStudios();
  }, [fetchCities, fetchStudios]);

  const handleSubmitStudio = useCallback(
    async (values: StudioFormValues) => {
      setIsSubmitting(true);
      const isEditing = Boolean(editingStudio);
      const editingId = editingStudio?.id;

      try {
        const payload = {
          name: values.name.trim(),
          city_id: values.cityId,
          quality: Number(values.quality),
          engineer_rating: Number(values.engineerRating),
          equipment_rating: Number(values.equipmentRating),
          cost_per_day: Number(values.costPerDay),
        };

        if (isEditing && editingId) {
          const { error } = await supabase.from("studios").update(payload).eq("id", editingId);

          if (error) throw error;

          toast({
            title: "Studio updated",
            description: `${values.name} has been saved.`,
          });
        } else {
          const { error } = await supabase.from("studios").insert(payload);

          if (error) throw error;

          toast({
            title: "Studio created",
            description: `${values.name} is now ready to be booked.`,
          });
        }

        studioForm.reset({ ...studioDefaultValues, cityId: values.cityId });
        setEditingStudio(null);
        await fetchStudios();
      } catch (error) {
        console.error(isEditing ? "Failed to update studio" : "Failed to create studio", error);
        toast({
          variant: "destructive",
          title: isEditing ? "Studio update failed" : "Studio creation failed",
          description: "We couldn't save the studio. Please review the form and try again.",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingStudio, fetchStudios, studioForm, toast],
  );

  const handleEditStudio = useCallback(
    (studio: StudioRow) => {
      setEditingStudio(studio);
      studioForm.reset({
        name: studio.name,
        cityId: studio.cityId ?? "",
        quality: studio.quality !== null ? `${studio.quality}` : "",
        engineerRating: studio.engineerRating !== null ? `${studio.engineerRating}` : "",
        equipmentRating: studio.equipmentRating !== null ? `${studio.equipmentRating}` : "",
        costPerDay: studio.costPerDay !== null ? `${studio.costPerDay}` : "",
      });
    },
    [studioForm],
  );

  const handleCancelEdit = useCallback(() => {
    studioForm.reset({ ...studioDefaultValues });
    setEditingStudio(null);
  }, [studioForm]);

  const handleDeleteStudio = useCallback(
    async (studioId: string) => {
      setDeletingStudioId(studioId);
      try {
        const { error } = await supabase.from("studios").delete().eq("id", studioId);
        if (error) throw error;

        setStudios((prev) => prev.filter((studio) => studio.id !== studioId));
        toast({
          title: "Studio removed",
          description: "The studio has been deleted.",
        });
      } catch (error) {
        console.error("Failed to delete studio", error);
        toast({
          variant: "destructive",
          title: "Unable to delete studio",
          description: "Please try again later.",
        });
      } finally {
        setDeletingStudioId(null);
      }
    },
    [toast],
  );

  const hasStudios = studios.length > 0;
  const formTitle = editingStudio ? "Update studio" : "Create studio";
  const formDescription = editingStudio
    ? "Modify studio stats to keep booking projections accurate."
    : "Configure a new recording space with ratings that influence session efficiency.";
  const submitLabel = editingStudio ? "Save studio" : "Create studio";
  const SubmitIcon = editingStudio ? Pencil : PlusCircle;

  return (
    <AdminRoute>
      <div className="container mx-auto max-w-6xl space-y-8 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Studios</h1>
          <p className="text-muted-foreground">
            Create and manage recording studios used by the booking system.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px,1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{formTitle}</CardTitle>
              <CardDescription>{formDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...studioForm}>
                <form className="space-y-4" onSubmit={studioForm.handleSubmit(handleSubmitStudio)}>
                  {editingStudio ? (
                    <div className="rounded-md border border-accent/40 bg-accent/5 p-3 text-sm text-accent">
                      Editing {editingStudio.name}. Saving will update the existing studio profile.
                    </div>
                  ) : null}
                  <FormField
                    control={studioForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Studio name</FormLabel>
                        <FormControl>
                          <Input placeholder="Silver Echo Studios" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={studioForm.control}
                    name="cityId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingCities}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={isLoadingCities ? "Loading cities..." : "Select a city"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {cities.length === 0 ? (
                              <SelectItem value="" disabled>
                                {isLoadingCities ? "Loading cities..." : "No cities available"}
                              </SelectItem>
                            ) : (
                              cities.map((city) => (
                                <SelectItem key={city.id} value={city.id}>
                                  {city.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={studioForm.control}
                    name="quality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quality rating</FormLabel>
                        <FormControl>
                          <Input placeholder="85" inputMode="numeric" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={studioForm.control}
                    name="engineerRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Engineer rating</FormLabel>
                        <FormControl>
                          <Input placeholder="88" inputMode="numeric" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={studioForm.control}
                    name="equipmentRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipment rating</FormLabel>
                        <FormControl>
                          <Input placeholder="92" inputMode="numeric" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={studioForm.control}
                    name="costPerDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost per day</FormLabel>
                        <FormControl>
                          <Input placeholder="1200" inputMode="numeric" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="rounded-md border border-dashed border-muted p-3 text-sm text-muted-foreground">
                    {baseEfficiencyNote}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button className="w-full sm:flex-1" disabled={isSubmitting || isLoadingCities} type="submit">
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <SubmitIcon className="h-4 w-4" />
                          {submitLabel}
                        </span>
                      )}
                    </Button>
                    {editingStudio ? (
                      <Button
                        className="w-full sm:flex-1"
                        disabled={isSubmitting}
                        type="button"
                        variant="outline"
                        onClick={handleCancelEdit}
                      >
                        Cancel edit
                      </Button>
                    ) : null}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Existing studios</CardTitle>
              <CardDescription>Review stats and remove outdated locations.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingStudios ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : hasStudios ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Studio</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead className="hidden md:table-cell">Quality</TableHead>
                      <TableHead className="hidden md:table-cell">Engineer</TableHead>
                      <TableHead className="hidden md:table-cell">Equipment</TableHead>
                      <TableHead>Cost / day</TableHead>
                      <TableHead className="w-16 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studios.map((studio) => {
                      const baseEfficiency =
                        studio.quality !== null &&
                        studio.engineerRating !== null &&
                        studio.equipmentRating !== null
                          ? Math.round((studio.quality + studio.engineerRating + studio.equipmentRating) / 3)
                          : null;

                      return (
                        <TableRow key={studio.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{studio.name}</span>
                              {baseEfficiency !== null ? (
                                <span className="text-xs text-muted-foreground">
                                  Base efficiency ~{baseEfficiency}%
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{studio.cityName}</TableCell>
                          <TableCell className="hidden md:table-cell">{ratingFormatter(studio.quality)}</TableCell>
                          <TableCell className="hidden md:table-cell">{ratingFormatter(studio.engineerRating)}</TableCell>
                          <TableCell className="hidden md:table-cell">{ratingFormatter(studio.equipmentRating)}</TableCell>
                          <TableCell>
                            {typeof studio.costPerDay === "number" ? (
                              <Badge variant="secondary">{numberFormatter.format(studio.costPerDay)}</Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                aria-label={`Edit ${studio.name}`}
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEditStudio(studio)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                aria-label="Delete studio"
                                disabled={deletingStudioId === studio.id}
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteStudio(studio.id)}
                              >
                                {deletingStudioId === studio.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="space-y-2 p-8 text-center">
                  <p className="text-sm font-medium">No studios configured</p>
                  <p className="text-sm text-muted-foreground">
                    Add your first studio to populate the recording booking pool.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
}
