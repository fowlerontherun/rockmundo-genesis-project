import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

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

const AdminUniversities = () => {
  const { toast } = useToast();
  const [universities, setUniversities] = useState<UniversityRow[]>([]);
  const [totalUniversities, setTotalUniversities] = useState(0);
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("city");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(false);
  const [isSubmittingUniversity, setIsSubmittingUniversity] = useState(false);
  const [editingUniversity, setEditingUniversity] = useState<UniversityRow | null>(null);
  const [deletingUniversityId, setDeletingUniversityId] = useState<string | null>(null);

  const universityForm = useForm<UniversityFormValues>({
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
      const { data, error, count } = await supabase
        .from("universities")
        .select("*", { count: "exact" })
        .order(sortColumn, { ascending: sortDirection === "asc" })
        .range((page - 1) * UNIVERSITY_PAGE_SIZE, page * UNIVERSITY_PAGE_SIZE - 1);

      if (error) throw error;

      setUniversities((data as UniversityRow[] | null) ?? []);
      if (typeof count === "number") {
        setTotalUniversities(count);
      } else {
        setTotalUniversities((data ?? []).length);
      }
    } catch (error) {
      console.error("Failed to load universities", error);
      toast({
        variant: "destructive",
        title: "Unable to load universities",
        description: "We couldn't load the list of universities. Please try again.",
      });
      setUniversities([]);
      setTotalUniversities(0);
    } finally {
      setIsLoadingUniversities(false);
    }
  }, [page, sortColumn, sortDirection, toast]);

  useEffect(() => {
    void handleFetchUniversities();
  }, [handleFetchUniversities]);

  const formTitle = useMemo(
    () => (editingUniversity ? "Update University" : "Create University"),
    [editingUniversity],
  );
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
    totalUniversities === 0 || universities.length === 0 ? 0 : (page - 1) * UNIVERSITY_PAGE_SIZE + 1;
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

  const resetUniversityForm = useCallback(() => {
    universityForm.reset({
      name: "",
      city: "",
      prestige: 50,
      qualityOfLearning: 50,
      courseCost: 0,
    });
    setEditingUniversity(null);
  }, [universityForm]);

  const handleSubmitUniversity = useCallback(
    async (values: UniversityFormValues) => {
      setIsSubmittingUniversity(true);
      const isEditing = Boolean(editingUniversity);
      const editingId = editingUniversity?.id;

      try {
        const payload: UniversityInsert = {
          name: values.name,
          city: values.city,
          prestige: values.prestige,
          quality_of_learning: values.qualityOfLearning,
          course_cost: values.courseCost,
        };

        if (isEditing && editingId) {
          const { error } = await supabase.from("universities").update(payload as UniversityUpdate).eq("id", editingId);
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
            description: `${values.name} is now available for players to discover.`,
          });
        }

        resetUniversityForm();
        if (page !== 1) {
          setPage(1);
        } else {
          await handleFetchUniversities();
        }
      } catch (error) {
        console.error("Failed to save university", error);
        toast({
          variant: "destructive",
          title: "Unable to save university",
          description: error instanceof Error ? error.message : "Something went wrong while saving the university.",
        });
      } finally {
        setIsSubmittingUniversity(false);
      }
    },
    [editingUniversity, handleFetchUniversities, page, resetUniversityForm, toast],
  );

  const handleEditUniversity = useCallback(
    (university: UniversityRow) => {
      setEditingUniversity(university);
      universityForm.reset({
        name: university.name ?? "",
        city: university.city ?? "",
        prestige: Number(university.prestige ?? 50),
        qualityOfLearning: Number(university.quality_of_learning ?? 50),
        courseCost: Number(university.course_cost ?? 0),
      });
    },
    [universityForm],
  );

  const handleDeleteUniversity = useCallback(
    async (id: string, name: string) => {
      setDeletingUniversityId(id);
      try {
        const { error } = await supabase.from("universities").delete().eq("id", id);
        if (error) throw error;

        setUniversities((prev) => prev.filter((item) => item.id !== id));
        setTotalUniversities((prev) => Math.max(prev - 1, 0));
        if (editingUniversity?.id === id) {
          resetUniversityForm();
        }

        await handleFetchUniversities();
        toast({
          title: "University deleted",
          description: `${name} has been removed from the world.`,
        });
      } catch (error) {
        console.error("Failed to delete university", error);
        toast({
          variant: "destructive",
          title: "Unable to delete university",
          description: error instanceof Error ? error.message : "Something went wrong while deleting the university.",
        });
      } finally {
        setDeletingUniversityId(null);
      }
    },
    [editingUniversity?.id, handleFetchUniversities, resetUniversityForm, toast],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Universities</h1>
        <p className="text-muted-foreground">
          Manage the universities that appear across the Rockmundo world and tune their prestige values.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> {formTitle}
            {editingUniversity ? <Badge variant="secondary">Editing</Badge> : null}
          </CardTitle>
          <CardDescription>{formDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...universityForm}>
            <form onSubmit={universityForm.handleSubmit(handleSubmitUniversity)} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={universityForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>University Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Rockmundo Conservatory" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={universityForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Los Angeles" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <FormField
                  control={universityForm.control}
                  name="prestige"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prestige</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={100} step={1} value={field.value ?? ""} {...field} />
                      </FormControl>
                      <FormDescription>Higher prestige attracts elite players.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={universityForm.control}
                  name="qualityOfLearning"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quality of Learning</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={100} step={1} value={field.value ?? ""} {...field} />
                      </FormControl>
                      <FormDescription>Impacts XP per lesson and overall training results.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={universityForm.control}
                  name="courseCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course Cost</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step={50} value={field.value ?? ""} {...field} />
                      </FormControl>
                      <FormDescription>Cost per course in world currency.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                {editingUniversity ? (
                  <Button type="button" variant="ghost" onClick={resetUniversityForm} disabled={isSubmittingUniversity}>
                    Cancel edit
                  </Button>
                ) : null}
                <Button type="submit" disabled={isSubmittingUniversity}>
                  {isSubmittingUniversity ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmittingUniversity ? "Saving" : editingUniversity ? "Update" : "Create"} University
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Universities</span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={sortColumn} onValueChange={(value) => handleSortColumnChange(value as SortColumn)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {sortColumnOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={handleToggleSortDirection}>
                {sortDirectionLabels[sortDirection]}
              </Button>
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
            </div>
          </CardTitle>
          <CardDescription>
            Review, edit or remove universities available to players.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span>
              {hasUniversities
                ? `Showing ${showingRangeStart.toLocaleString()}-${showingRangeEnd.toLocaleString()} of ${totalUniversities.toLocaleString()} universities`
                : "No universities yet"}
            </span>
          </div>

          {isLoadingUniversities ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading universities...
            </div>
          ) : universities.length === 0 ? (
            <p className="text-muted-foreground">
              No universities have been defined yet. Create one using the form above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
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
                    <TableCell className="font-medium">{university.name}</TableCell>
                    <TableCell>{university.city}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {typeof university.prestige === "number" ? university.prestige : "-"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {typeof university.quality_of_learning === "number" ? university.quality_of_learning : "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {typeof university.course_cost === "number"
                        ? currencyFormatter.format(university.course_cost)
                        : "-"}
                    </TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleEditUniversity(university)}
                        title="Edit university"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() =>
                          handleDeleteUniversity(
                            university.id,
                            university.city ?? university.name ?? "this university",
                          )
                        }
                        disabled={deletingUniversityId === university.id}
                        title="Delete university"
                      >
                        {deletingUniversityId === university.id ? (
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

          {hasUniversities ? (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    className={page === 1 ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      handlePageChange(page - 1);
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-3 text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      handlePageChange(page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUniversities;
