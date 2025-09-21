import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, RefreshCcw, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";

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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { currencyFormatter } from "./shared";
import {
  SortColumn,
  SortDirection,
  UNIVERSITY_PAGE_SIZE,
  UniversityFormValues,
  UniversityInsert,
  UniversityRow,
  UniversityUpdate,
  sortColumnOptions,
  sortDirectionLabels,
  universitySchema,
} from "./universities.helpers";

export default function Universities() {
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
    totalUniversities === 0 || universities.length === 0
      ? 0
      : (page - 1) * UNIVERSITY_PAGE_SIZE + 1;

  const showingRangeEnd =
    totalUniversities === 0 || universities.length === 0
      ? 0
      : Math.min(showingRangeStart + universities.length - 1, totalUniversities);

  const hasUniversities = totalUniversities > 0;

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
          const updatePayload: UniversityUpdate = { ...payload };
          const { error } = await supabase
            .from("universities")
            .update(updatePayload)
            .eq("id", editingId);

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

        resetUniversityForm();
        if (!isEditing && page !== 1) {
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
        prestige: university.prestige ?? 50,
        qualityOfLearning: university.quality_of_learning ?? 50,
        courseCost: university.course_cost ?? 0,
      });
    },
    [universityForm],
  );

  const handleDeleteUniversity = useCallback(
    async (id: string, city: string) => {
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
          description: `${city || "the selected university"} has been removed from the roster.`,
        });
      } catch (error) {
        console.error("Failed to delete university", error);
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: "We couldn't remove the university. Please try again.",
        });
      } finally {
        setDeletingUniversityId(null);
      }
    },
    [editingUniversity?.id, handleFetchUniversities, resetUniversityForm, toast],
  );

  return (
    <AdminRoute>
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Universities</h1>
          <p className="text-muted-foreground">
            Maintain the roster of universities that influence the education gameplay loop.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xl">
              {formTitle}
              {editingUniversity ? <Badge variant="secondary">Editing</Badge> : null}
            </CardTitle>
            <CardDescription>{formDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...universityForm}>
              <form
                onSubmit={universityForm.handleSubmit(handleSubmitUniversity)}
                className="grid gap-6 md:grid-cols-2"
              >
                <FormField
                  control={universityForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>University Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter university name" autoComplete="organization" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={universityForm.control}
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
                  control={universityForm.control}
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
                  control={universityForm.control}
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
                  control={universityForm.control}
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetUniversityForm}
                      disabled={isSubmittingUniversity}
                    >
                      Reset
                    </Button>
                  ) : null}
                  <Button type="submit" disabled={isSubmittingUniversity}>
                    {isSubmittingUniversity ? (
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
              <span>Universities</span>
              <div className="flex items-center gap-2">
                <Select value={sortColumn} onValueChange={(value) => handleSortColumnChange(value as SortColumn)}>
                  <SelectTrigger className="w-[180px]">
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
                <Button type="button" variant="outline" size="sm" onClick={handleToggleSortDirection}>
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
            <CardDescription>Review, edit or remove universities available to players.</CardDescription>
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
                        {typeof university.quality_of_learning === "number"
                          ? university.quality_of_learning
                          : "-"}
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
    </AdminRoute>
  );
}
