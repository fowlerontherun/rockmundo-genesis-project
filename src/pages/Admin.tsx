import React, { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AdminRoute } from "@/components/AdminRoute";
import { SKILL_TREE_DEFINITIONS, type TierName } from "@/data/skillTree";
import type { SkillDefinitionRecord } from "@/hooks/useSkillSystem.types";

const UNIVERSITY_PAGE_SIZE = 10;

const BOOK_XP_VALUE = 10;
const BOOK_SEED_COSTS: Record<TierName, number> = {
  Basic: 250,
  Professional: 750,
  Mastery: 1500,
};

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

const skillBookSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug may only include lowercase letters, numbers, and hyphens"),
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author is required"),
  description: z.string().min(1, "Description is required"),
  skillSlug: z.string().min(1, "Skill selection is required"),
  cost: z
    .coerce
    .number({ invalid_type_error: "Cost must be a number" })
    .min(0, "Cost cannot be negative"),
  xpReward: z
    .coerce
    .number({ invalid_type_error: "XP reward must be a number" })
    .refine((value) => value === 10, "XP reward is fixed at 10"),
});

type SkillBookFormValues = z.infer<typeof skillBookSchema>;

type SkillBooksTable = Database["public"]["Tables"] extends { skill_books: infer T }
  ? T
  : {
      Row: {
        id: string;
        slug: string;
        title: string;
        author: string | null;
        description: string | null;
        skill_slug: string;
        cost: number;
        xp_reward: number;
        created_at: string | null;
        updated_at: string | null;
      };
      Insert: {
        slug: string;
        title: string;
        author?: string | null;
        description?: string | null;
        skill_slug: string;
        cost: number;
        xp_reward?: number;
      };
      Update: {
        slug?: string;
        title?: string;
        author?: string | null;
        description?: string | null;
        skill_slug?: string;
        cost?: number;
        xp_reward?: number;
      };
    };

type SkillBookRow = SkillBooksTable extends { Row: infer R } ? R : never;
type SkillBookInsert = SkillBooksTable extends { Insert: infer I } ? I : never;
type SkillBookUpdate = SkillBooksTable extends { Update: infer U } ? U : never;
type SkillDefinitionsTable = Database["public"]["Tables"] extends { skill_definitions: infer T }
  ? T
  : {
      Row: {
        id: string;
        slug: string;
        display_name: string;
      };
    };

type SkillDefinitionRow = SkillDefinitionsTable extends { Row: infer R } ? R : never;
export default function Admin() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"universities" | "books">("universities");
  const [universities, setUniversities] = useState<UniversityRow[]>([]);
  const [totalUniversities, setTotalUniversities] = useState(0);
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("city");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(false);
  const [isSubmittingUniversity, setIsSubmittingUniversity] = useState(false);
  const [editingUniversity, setEditingUniversity] = useState<UniversityRow | null>(null);
  const [deletingUniversityId, setDeletingUniversityId] = useState<string | null>(null);
  const [skillBooks, setSkillBooks] = useState<SkillBookRow[]>([]);
  const [skillDefinitions, setSkillDefinitions] = useState<SkillDefinitionRow[]>([]);
  const [isLoadingSkillBooks, setIsLoadingSkillBooks] = useState(false);
  const [isSubmittingBook, setIsSubmittingBook] = useState(false);
  const [editingSkillBook, setEditingSkillBook] = useState<SkillBookRow | null>(null);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
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

  const skillBookForm = useForm<SkillBookFormValues>({
    resolver: zodResolver(skillBookSchema),
    defaultValues: {
      slug: "",
      title: "",
      author: "",
      description: "",
      skillSlug: "",
      cost: 0,
      xpReward: 10,
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

  const handleFetchSkillBooks = useCallback(async () => {
    setIsLoadingSkillBooks(true);
    try {
      const { data, error } = await supabase
        .from("skill_books")
        .select("*")
        .order("cost", { ascending: true })
        .order("title", { ascending: true });

      if (error) throw error;

      setSkillBooks((data as SkillBookRow[] | null) ?? []);
    } catch (error) {
      console.error("Failed to load skill books", error);
      toast({
        variant: "destructive",
        title: "Unable to load skill books",
        description: "We couldn't retrieve the skill books. Please try again later.",
      });
    } finally {
      setIsLoadingSkillBooks(false);
    }
  }, [toast]);

  const handleFetchSkillDefinitions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("skill_definitions")
        .select("id, slug, display_name")
        .order("display_name", { ascending: true });

      if (error) throw error;

      setSkillDefinitions((data as SkillDefinitionRow[] | null) ?? []);
    } catch (error) {
      console.error("Failed to load skill definitions", error);
      toast({
        variant: "destructive",
        title: "Unable to load skills",
        description: "We couldn't fetch the skill catalog. Refresh and try again.",
      });
    }
  }, [toast]);

  const handleFetchSkillBooks = useCallback(async () => {
    setIsLoadingSkillBooks(true);
    try {
      const { data, error } = await supabase
        .from("skill_books")
        .select("*")
        .order("title", { ascending: true });

      if (error) throw error;

      setSkillBooks((data as SkillBookRow[] | null) ?? []);
    } catch (error) {
      console.error("Failed to load skill books", error);
      toast({
        variant: "destructive",
        title: "Unable to load books",
        description: "We couldn't retrieve the skill books list. Please try again later.",
      });
    } finally {
      setIsLoadingSkillBooks(false);
    }
  }, [toast]);

  useEffect(() => {
    void handleFetchUniversities();
  }, [handleFetchUniversities]);

  useEffect(() => {
    void handleFetchSkillDefinitions();
    void handleFetchSkillBooks();
  }, [handleFetchSkillDefinitions, handleFetchSkillBooks]);

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

  const skillBookFormTitle = useMemo(
    () => (editingSkillBook ? "Update Skill Book" : "Create Skill Book"),
    [editingSkillBook],
  );
  const skillBookFormDescription = useMemo(
    () =>
      editingSkillBook
        ? "Adjust the selected book's details or align it with a different skill unlock."
        : "Add a new book that players can purchase to unlock skills with a 10 XP reward.",
    [editingSkillBook],
  );

  const skillDefinitionBySlug = useMemo(() => {
    return skillDefinitions.reduce<Record<string, SkillDefinitionRow>>((acc, definition) => {
      if (definition.slug) {
        acc[definition.slug] = definition;
      }
      return acc;
    }, {});
  }, [skillDefinitions]);

  const resetFormState = useCallback(() => {
    universityForm.reset({
      city: "",
      prestige: 50,
      qualityOfLearning: 50,
      courseCost: 0,
    });
    setEditingUniversity(null);
  }, [universityForm]);

  const resetSkillBookForm = useCallback(() => {
    skillBookForm.reset({
      slug: "",
      title: "",
      author: "",
      description: "",
      skillSlug: "",
      cost: 0,
      xpReward: 10,
    });
    setEditingSkillBook(null);
  }, [skillBookForm]);

  const resetSkillBookForm = useCallback(() => {
    skillBookForm.reset({
      skillSlug: "",
      title: "",
      description: "",
      cost: 0,
      xpValue: BOOK_XP_VALUE,
      isActive: true,
    });
    setEditingSkillBook(null);
  }, [skillBookForm]);

  const onSubmit = useCallback(
    async (values: UniversityFormValues) => {
      setIsSubmittingUniversity(true);
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
        setIsSubmittingUniversity(false);
      }
    },
    [editingUniversity, handleFetchUniversities, page, resetFormState, toast],
  );

  const handleSubmitSkillBook = useCallback(
    async (values: SkillBookFormValues) => {
      setIsSubmittingSkillBook(true);
      try {
        const payload: SkillBookInsert = {
          skill_slug: values.skillSlug,
          title: values.title,
          description: values.description?.trim() ? values.description.trim() : null,
          cost: values.cost,
          xp_value: values.xpValue,
          is_active: values.isActive,
        };

        if (editingSkillBook) {
          const updatePayload: SkillBookUpdate = { ...payload };
          const { error } = await supabase
            .from("skill_books")
            .update(updatePayload)
            .eq("id", editingSkillBook.id);

          if (error) throw error;

          toast({
            title: "Skill book updated",
            description: `${values.title} has been saved.`,
          });
        } else {
          const { error } = await supabase.from("skill_books").insert(payload);

          if (error) throw error;

          toast({
            title: "Skill book created",
            description: `${values.title} is now available for players.`,
          });
        }

        resetSkillBookForm();
        await handleFetchSkillBooks();
      } catch (error) {
        console.error("Failed to save skill book", error);
        toast({
          variant: "destructive",
          title: "Save failed",
          description: "We couldn't save the skill book. Please try again.",
        });
      } finally {
        setIsSubmittingSkillBook(false);
      }
    },
    [editingSkillBook, handleFetchSkillBooks, resetSkillBookForm, toast],
  );

  const onSubmitSkillBook = useCallback(
    async (values: SkillBookFormValues) => {
      setIsSubmittingBook(true);
      try {
        const payload: SkillBookInsert = {
          slug: values.slug,
          title: values.title,
          author: values.author,
          description: values.description,
          skill_slug: values.skillSlug,
          cost: values.cost,
          xp_reward: values.xpReward,
        };

        if (editingSkillBook) {
          const updatePayload: SkillBookUpdate = { ...payload };
          const { error } = await supabase
            .from("skill_books")
            .update(updatePayload)
            .eq("id", editingSkillBook.id);

          if (error) throw error;

          toast({
            title: "Book updated",
            description: `${values.title} has been updated successfully.`,
          });
        } else {
          const { error } = await supabase.from("skill_books").insert(payload);

          if (error) throw error;

          toast({
            title: "Book created",
            description: `${values.title} is now available for purchase.`,
          });
        }

        resetSkillBookForm();
        await handleFetchSkillBooks();
      } catch (error) {
        console.error("Failed to submit skill book", error);
        toast({
          variant: "destructive",
          title: "Save failed",
          description: "We couldn't save the book. Please review the details and try again.",
        });
      } finally {
        setIsSubmittingBook(false);
      }
    },
    [editingSkillBook, handleFetchSkillBooks, resetSkillBookForm, toast],
  );

  const handleEdit = useCallback(
    (university: UniversityRow) => {
      setEditingUniversity(university);
      universityForm.reset({
        city: university.city ?? "",
        prestige: university.prestige ?? 50,
        qualityOfLearning: university.quality_of_learning ?? 50,
        courseCost: university.course_cost ?? 0,
      });
    },
    [universityForm],
  );

  const handleEditSkillBook = useCallback(
    (book: SkillBookRow) => {
      setEditingSkillBook(book);
      skillBookForm.reset({
        slug: book.slug ?? "",
        title: book.title ?? "",
        author: book.author ?? "",
        description: book.description ?? "",
        skillSlug: book.skill_slug ?? "",
        cost: book.cost ?? 0,
        xpReward: book.xp_reward ?? 10,
      });
    },
    [skillBookForm],
  );

  const handleEditSkillBook = useCallback(
    (book: SkillBookRow) => {
      setEditingSkillBook(book);
      skillBookForm.reset({
        skillSlug: book.skill_slug,
        title: book.title,
        description: book.description ?? "",
        cost: typeof book.cost === "number" ? book.cost : Number(book.cost ?? 0),
        xpValue: typeof book.xp_value === "number" ? book.xp_value : BOOK_XP_VALUE,
        isActive: Boolean(book.is_active),
      });
    },
    [skillBookForm],
  );

  const handleDelete = useCallback(
    async (id: string, city: string) => {
      setDeletingUniversityId(id);

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
        await handleFetchUniversities();
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
    [editingUniversity?.id, handleFetchUniversities, resetFormState, toast],
  );

  const handleDeleteSkillBook = useCallback(
    async (id: string, title: string) => {
      setDeletingBookId(id);
      try {
        const { error } = await supabase.from("skill_books").delete().eq("id", id);

        if (error) throw error;
        setSkillBooks((prev) => prev.filter((item) => item.id !== id));
        if (editingSkillBook?.id === id) {
          resetSkillBookForm();
        }

        toast({
          title: "Book deleted",
          description: `${title} has been removed from the catalog.`,
        });
      } catch (error) {
        console.error("Failed to delete skill book", error);
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: "We couldn't remove the book. Please try again.",
        });
      } finally {
        setDeletingBookId(null);
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
                      <p className="text-muted-foreground">No universities have been defined yet. Create one using the form above.</p>
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
                              <TableCell className="hidden sm:table-cell">{university.quality_of_learning ?? "-"}</TableCell>
                              <TableCell className="hidden md:table-cell">
                                {typeof university.course_cost === "number" ? `$${university.course_cost.toLocaleString()}` : "-"}
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
