import React, { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpDown, Loader2, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { AdminRoute } from "@/components/AdminRoute";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AdminRoute } from "@/components/AdminRoute";

const UNIVERSITY_PAGE_SIZE = 10;

type SortColumn = "name" | "city" | "prestige" | "quality_of_learning" | "course_cost";
type SortDirection = "asc" | "desc";

const sortColumnOptions: { value: SortColumn; label: string }[] = [
  { value: "city", label: "City" },
  { value: "name", label: "Name" },
  { value: "prestige", label: "Prestige" },
  { value: "quality_of_learning", label: "Quality of Learning" },
  { value: "course_cost", label: "Course Cost" },
];

const sortDirectionLabels: Record<SortDirection, string> = {
  asc: "Ascending",
  desc: "Descending",
};

const universitySchema = z.object({
  name: z.string().min(1, "Name is required"),
  city: z.string().min(1, "City is required"),
  prestige: z
    .coerce
    .number({ invalid_type_error: "Prestige must be a number" })
    .min(0, "Prestige must be at least 0")
    .max(100, "Prestige cannot exceed 100"),
  qualityOfLearning: z
    .coerce
    .number({ invalid_type_error: "Quality must be a number" })
    .min(0, "Quality must be at least 0")
    .max(100, "Quality cannot exceed 100"),
  courseCost: z
    .coerce
    .number({ invalid_type_error: "Course cost must be a number" })
    .min(0, "Course cost cannot be negative"),
});

type UniversityFormValues = z.infer<typeof universitySchema>;
type UniversitiesTable = Database["public"]["Tables"] extends { universities: infer T }
  ? T
  : {
      Row: {
        id: string;
        name: string;
        city: string;
        prestige: number | null;
        quality_of_learning: number | null;
        course_cost: number | null;
        created_at: string | null;
      };
      Insert: {
        name: string;
        city: string;
        prestige?: number | null;
        quality_of_learning?: number | null;
        course_cost?: number | null;
      };
      Update: {
        name?: string;
        city?: string;
        prestige?: number | null;
        quality_of_learning?: number | null;
        course_cost?: number | null;
      };
    };

type UniversityRow = UniversitiesTable extends { Row: infer R } ? R : never;
type UniversityInsert = UniversitiesTable extends { Insert: infer I } ? I : never;
type UniversityUpdate = UniversitiesTable extends { Update: infer U } ? U : never;

export default function Admin() {
  const { toast } = useToast();
  const [universities, setUniversities] = useState<UniversityRow[]>([]);
  const [totalUniversities, setTotalUniversities] = useState(0);
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("city");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUniversity, setEditingUniversity] = useState<UniversityRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const form = useForm<UniversityFormValues>({
    resolver: zodResolver(universitySchema),
    defaultValues: {
      name: "",
      city: "",
      prestige: 50,
      qualityOfLearning: 50,
      courseCost: 0,
    },
  });

  const handleFetchUniversities = useCallback(async () => {
    setIsLoadingUniversities(true);
    try {
      const from = (page - 1) * UNIVERSITY_PAGE_SIZE;
      const to = from + UNIVERSITY_PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("universities")
        .select("*", { count: "exact" })
        .order(sortColumn, { ascending: sortDirection === "asc" })
        .range(from, to);

      if (error) throw error;

      setUniversities((data as UniversityRow[] | null) ?? []);
      if (typeof count === "number") {
        setTotalUniversities(count);
        if (count === 0) {
          if (page !== 1) {
            setPage(1);
          }
        } else if (from >= count) {
          const lastPage = Math.max(Math.ceil(count / UNIVERSITY_PAGE_SIZE), 1);
          if (lastPage !== page) {
            setPage(lastPage);
          }
        }
      } else {
        setTotalUniversities(0);
      }
    } catch (error) {
      console.error("Failed to load universities", error);
      toast({
        variant: "destructive",
        title: "Unable to load universities",
        description: "We couldn't retrieve the universities list. Please try again later.",
      });
    } finally {
      setIsLoadingUniversities(false);
    }
  }, [page, sortColumn, sortDirection, toast]);

  useEffect(() => {
    void handleFetchUniversities();
  }, [handleFetchUniversities]);

  const formTitle = useMemo(() => (editingUniversity ? "Update University" : "Create University"), [editingUniversity]);
  const formDescription = useMemo(
    () =>
      editingUniversity
        ? "Edit the selected university and update its quality metrics."
        : "Define a new university hub, including its prestige and learning quality.",
    [editingUniversity],
  );
  const totalPages = useMemo(
    () => (totalUniversities > 0 ? Math.ceil(totalUniversities / UNIVERSITY_PAGE_SIZE) : 1),
    [totalUniversities],
  );
  const showingRangeStart =
    totalUniversities === 0 || universities.length === 0
      ? 0
      : (page - 1) * UNIVERSITY_PAGE_SIZE + 1;
  const showingRangeEnd =
    totalUniversities === 0 || universities.length === 0
      ? 0
      : Math.min(showingRangeStart + universities.length - 1, totalUniversities);
  const hasUniversities = totalUniversities > 0;

  const handleSortColumnChange = useCallback(
    (value: SortColumn) => {
      if (sortColumn !== value) {
        setSortColumn(value);
        if (page !== 1) {
          setPage(1);
        }
      }
    },
    [page, sortColumn],
  );

  const handleToggleSortDirection = useCallback(() => {
    setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
  }, []);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage >= 1 && nextPage <= totalPages && nextPage !== page) {
        setPage(nextPage);
      }
    },
    [page, totalPages],
  );

  const resetFormState = useCallback(() => {
    form.reset({
      name: "",
      city: "",
      prestige: 50,
      qualityOfLearning: 50,
      courseCost: 0,
    });
    setEditingUniversity(null);
  }, [form]);

  const onSubmit = useCallback(
    async (values: UniversityFormValues) => {
      setIsSubmitting(true);
      try {
        const payload: UniversityInsert = {
          name: values.name,
          city: values.city,
          prestige: values.prestige,
          quality_of_learning: values.qualityOfLearning,
          course_cost: values.courseCost,
        };

        if (editingUniversity) {
          const updatePayload: UniversityUpdate = { ...payload };
          const { error } = await supabase
            .from("universities")
            .update(updatePayload)
            .eq("id", editingUniversity.id);

          if (error) throw error;

          toast({
            title: "University updated",
            description: `${values.name} has been updated successfully.`,
          });
        } else {
          const { error } = await supabase.from("universities").insert(payload);

          if (error) throw error;

          toast({
            title: "University created",
            description: `${values.name} is now available in the world.`,
          });
        }

        resetFormState();
        if (!editingUniversity && page !== 1) {
          setPage(1);
        } else {
          await handleFetchUniversities();
        }
      } catch (error) {
        console.error("Failed to submit university", error);
        toast({
          variant: "destructive",
          title: "Save failed",
          description: "We couldn't save the university. Please review the details and try again.",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingUniversity, handleFetchUniversities, page, resetFormState, toast],
  );

  const handleEdit = useCallback(
    (university: UniversityRow) => {
      setEditingUniversity(university);
      form.reset({
        name: university.name ?? "",
        city: university.city ?? "",
        prestige: university.prestige ?? 50,
        qualityOfLearning: university.quality_of_learning ?? 50,
        courseCost: university.course_cost ?? 0,
      });
    },
    [form],
  );

  const handleDelete = useCallback(
    async (id: string, label: string) => {
      setDeletingId(id);
      try {
        const { error } = await supabase.from("universities").delete().eq("id", id);

        if (error) throw error;

        const isLastItemOnPage = universities.length <= 1;
        const nextTotal = Math.max(totalUniversities - 1, 0);

        setUniversities((prev) => prev.filter((item) => item.id !== id));
        setTotalUniversities(nextTotal);
        if (editingUniversity?.id === id) {
          resetFormState();
        }
        await handleFetchUniversities();
        toast({
          title: "University deleted",
          description: `${label} has been removed from the roster.`,
        });
      } catch (error) {
        console.error("Failed to delete university", error);
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: "We couldn't remove the university. Please try again.",
        });
      } finally {
        setDeletingId(null);
      }
    },
    [editingUniversity?.id, handleFetchUniversities, resetFormState, toast],
  );

  return (
    <AdminRoute>
      <div className="container mx-auto max-w-6xl p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground">Configure world data and manage gameplay balancing parameters.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Maintain reference data that powers the game world.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="universities" className="space-y-6">
              <TabsList className="grid w-full max-w-xs grid-cols-1">
                <TabsTrigger value="universities" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Universities
                </TabsTrigger>
              </TabsList>

              <TabsContent value="universities" className="space-y-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl flex items-center justify-between">
                      {formTitle}
                      {editingUniversity ? <Badge variant="secondary">Editing</Badge> : null}
                    </CardTitle>
                    <CardDescription>{formDescription}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter city name" autoComplete="address-level2" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="prestige"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prestige (0-100)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={Number.isFinite(field.value) ? field.value : ""}
                                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="qualityOfLearning"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quality of Learning (0-100)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={Number.isFinite(field.value) ? field.value : ""}
                                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="courseCost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Average Course Cost</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  step={100}
                                  value={Number.isFinite(field.value) ? field.value : ""}
                                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="md:col-span-2 flex items-center justify-end gap-2">
                          {editingUniversity ? (
                            <Button type="button" variant="outline" onClick={resetFormState} disabled={isSubmitting}>
                              Reset
                            </Button>
                          ) : null}
                          <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving
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
                    <CardTitle className="text-xl flex items-center gap-2">
                      Universities
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleFetchUniversities()}
                        disabled={isLoadingUniversities}
                      >
                        <RefreshCcw className={`h-4 w-4 ${isLoadingUniversities ? "animate-spin" : ""}`} />
                        <span className="sr-only">Refresh universities</span>
                      </Button>
                    </CardTitle>
                    <CardDescription>Review, edit or remove universities available to players.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingUniversities ? (
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading universities...
                      </div>
                    ) : universities.length === 0 ? (
                      <p className="text-muted-foreground">
                        No universities have been defined yet. Create one using the form above.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>City</TableHead>
                            <TableHead className="hidden sm:table-cell">Prestige</TableHead>
                            <TableHead className="hidden sm:table-cell">Quality</TableHead>
                            <TableHead className="hidden md:table-cell">Course Cost</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {universities.map((university) => (
                            <TableRow key={university.id}>
                              <TableCell className="font-medium">{university.city}</TableCell>
                              <TableCell className="hidden sm:table-cell">{university.prestige ?? "-"}</TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {university.quality_of_learning ?? "-"}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {typeof university.course_cost === "number"
                                  ? `$${university.course_cost.toLocaleString()}`
                                  : "-"}
                              </TableCell>
                              <TableCell className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEdit(university)}
                                  title="Edit university"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => handleDelete(university.id, university.city ?? "this university")}
                                  disabled={deletingId === university.id}
                                  title="Delete university"
                                >
                                  {deletingId === university.id ? (
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
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
}
