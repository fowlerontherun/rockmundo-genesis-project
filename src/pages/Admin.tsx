import React, { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpDown, BookOpen, Loader2, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  skillSlug: z.string().min(1, "Skill selection is required"),
  title: z.string().min(1, "Title is required"),
  description: z
    .string()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .or(z.literal("")),
  cost: z
    .coerce
    .number({ invalid_type_error: "Cost must be a number" })
    .min(0, "Cost cannot be negative"),
  xpValue: z
    .coerce
    .number({ invalid_type_error: "XP value must be a number" })
    .min(0, "XP value cannot be negative"),
  isActive: z.boolean(),
});

type SkillBookFormValues = z.infer<typeof skillBookSchema>;

type SkillBooksTable = Database["public"]["Tables"] extends { skill_books: infer T }
  ? T
  : {
      Row: {
        id: string;
        skill_slug: string;
        title: string;
        description: string | null;
        cost: number;
        xp_value: number;
        is_active: boolean;
        created_at: string | null;
        updated_at: string | null;
      };
      Insert: {
        skill_slug: string;
        title: string;
        description?: string | null;
        cost?: number;
        xp_value?: number;
        is_active?: boolean;
      };
      Update: {
        skill_slug?: string;
        title?: string;
        description?: string | null;
        cost?: number;
        xp_value?: number;
        is_active?: boolean;
      };
    };

type SkillBookRow = SkillBooksTable extends { Row: infer R } ? R : never;
type SkillBookInsert = SkillBooksTable extends { Insert: infer I } ? I : never;
type SkillBookUpdate = SkillBooksTable extends { Update: infer U } ? U : never;

export default function Admin() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"universities" | "books">("universities");
  const [universities, setUniversities] = useState<UniversityRow[]>([]);
  const [totalUniversities, setTotalUniversities] = useState(0);
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn>("city");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUniversity, setEditingUniversity] = useState<UniversityRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [skillBooks, setSkillBooks] = useState<SkillBookRow[]>([]);
  const [isLoadingSkillBooks, setIsLoadingSkillBooks] = useState(false);
  const [isSubmittingSkillBook, setIsSubmittingSkillBook] = useState(false);
  const [editingSkillBook, setEditingSkillBook] = useState<SkillBookRow | null>(null);
  const [deletingSkillBookId, setDeletingSkillBookId] = useState<string | null>(null);
  const [isSeedingBooks, setIsSeedingBooks] = useState(false);

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

  const skillBookForm = useForm<SkillBookFormValues>({
    resolver: zodResolver(skillBookSchema),
    defaultValues: {
      skillSlug: "",
      title: "",
      description: "",
      cost: 0,
      xpValue: BOOK_XP_VALUE,
      isActive: true,
    },
  });

  const skillDefinitionMap = useMemo(() => {
    const map = new Map<string, SkillDefinitionRecord>();
    for (const definition of SKILL_TREE_DEFINITIONS) {
      map.set(definition.slug, definition);
    }
    return map;
  }, []);

  const skillOptions = useMemo(
    () =>
      Array.from(skillDefinitionMap.values())
        .sort((a, b) => (a.display_name ?? a.slug).localeCompare(b.display_name ?? b.slug))
        .map((definition) => {
          const metadata = (definition.metadata ?? {}) as Record<string, unknown>;
          const tierValue = metadata.tier;
          const tier: TierName | undefined =
            typeof tierValue === "string" && (tierValue === "Basic" || tierValue === "Professional" || tierValue === "Mastery")
              ? (tierValue as TierName)
              : undefined;
          return {
            value: definition.slug,
            label: definition.display_name ?? definition.slug,
            tier,
          };
        }),
    [skillDefinitionMap],
  );

  const getSkillMetadata = useCallback(
    (slug: string) => {
      const definition = skillDefinitionMap.get(slug);
      const metadata = (definition?.metadata ?? {}) as Record<string, unknown>;
      const tierValue = metadata.tier;
      const tier: TierName | undefined =
        typeof tierValue === "string" && (tierValue === "Basic" || tierValue === "Professional" || tierValue === "Mastery")
          ? (tierValue as TierName)
          : undefined;
      const track = typeof metadata.track === "string" ? metadata.track : undefined;
      const category = typeof metadata.category === "string" ? metadata.category : undefined;
      return {
        name: definition?.display_name ?? slug,
        tier,
        track,
        category,
        description: definition?.description ?? null,
      };
    },
    [skillDefinitionMap],
  );

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

  useEffect(() => {
    void handleFetchUniversities();
  }, [handleFetchUniversities]);

  useEffect(() => {
    void handleFetchSkillBooks();
  }, [handleFetchSkillBooks]);

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
        const shouldGoBackPage =
          page > 1 && (isLastItemOnPage || nextTotal <= (page - 1) * UNIVERSITY_PAGE_SIZE);

        if (shouldGoBackPage) {
          setPage((previous) => Math.max(previous - 1, 1));
        } else {
          await handleFetchUniversities();
        }

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
    [
      editingUniversity?.id,
      handleFetchUniversities,
      page,
      resetFormState,
      toast,
      totalUniversities,
      universities.length,
    ],
  );

  const handleDeleteSkillBook = useCallback(
    async (id: string, label: string) => {
      setDeletingSkillBookId(id);
      try {
        const { error } = await supabase.from("skill_books").delete().eq("id", id);

        if (error) throw error;

        setSkillBooks((previous) => previous.filter((book) => book.id !== id));
        if (editingSkillBook?.id === id) {
          resetSkillBookForm();
        }

        toast({
          title: "Skill book deleted",
          description: `${label} has been removed.`,
        });
      } catch (error) {
        console.error("Failed to delete skill book", error);
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: "We couldn't remove the skill book. Please try again.",
        });
      } finally {
        setDeletingSkillBookId(null);
      }
    },
    [editingSkillBook?.id, resetSkillBookForm, toast],
  );

  const handleSeedSkillBooks = useCallback(async () => {
    setIsSeedingBooks(true);
    try {
      const inserts: SkillBookInsert[] = Array.from(skillDefinitionMap.entries()).map(([slug, definition]) => {
        const metadata = (definition.metadata ?? {}) as Record<string, unknown>;
        const tierValue = metadata.tier;
        const tier: TierName | undefined =
          typeof tierValue === "string" && (tierValue === "Basic" || tierValue === "Professional" || tierValue === "Mastery")
            ? (tierValue as TierName)
            : undefined;
        const description =
          typeof definition.description === "string" && definition.description.trim().length > 0
            ? definition.description
            : `Unlock the ${definition.display_name ?? slug} skill instantly.`;

        return {
          skill_slug: slug,
          title: definition.display_name ?? slug,
          description,
          cost: tier ? BOOK_SEED_COSTS[tier] : BOOK_SEED_COSTS.Basic,
          xp_value: BOOK_XP_VALUE,
          is_active: true,
        } satisfies SkillBookInsert;
      });

      const { error } = await supabase.from("skill_books").upsert(inserts, { onConflict: "skill_slug" });

      if (error) throw error;

      toast({
        title: "Skill books synced",
        description: "The catalog now matches the latest skill tree definitions.",
      });

      await handleFetchSkillBooks();
    } catch (error) {
      console.error("Failed to seed skill books", error);
      toast({
        variant: "destructive",
        title: "Seeding failed",
        description: "We couldn't generate the skill books from the skill tree.",
      });
    } finally {
      setIsSeedingBooks(false);
    }
  }, [handleFetchSkillBooks, skillDefinitionMap, toast]);

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
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "universities" | "books")}
            className="space-y-6"
          >
            <TabsList className="grid w-full max-w-sm grid-cols-2 gap-2">
              <TabsTrigger value="books" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Books
              </TabsTrigger>
              <TabsTrigger value="universities" className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Universities
              </TabsTrigger>
            </TabsList>

            <TabsContent value="books" className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-xl">
                    {editingSkillBook ? "Update Skill Book" : "Create Skill Book"}
                    {editingSkillBook ? <Badge variant="secondary">Editing</Badge> : null}
                  </CardTitle>
                  <CardDescription>
                    Define purchasable books that unlock and accelerate skill tree progress.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...skillBookForm}>
                    <form onSubmit={skillBookForm.handleSubmit(handleSubmitSkillBook)} className="grid gap-6 md:grid-cols-2">
                      <FormField
                        control={skillBookForm.control}
                        name="skillSlug"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Linked Skill</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Choose a skill" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {skillOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <div className="flex items-center justify-between gap-2">
                                      <span>{option.label}</span>
                                      {option.tier ? <Badge variant="outline">{option.tier}</Badge> : null}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={skillBookForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Book Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter the display title" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={skillBookForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Optional blurb shown to players"
                                rows={3}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={skillBookForm.control}
                        name="cost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cost</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                step={50}
                                value={Number.isFinite(field.value) ? field.value : ""}
                                onChange={(event) => field.onChange(event.target.valueAsNumber)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={skillBookForm.control}
                        name="xpValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>XP Reward</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
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
                        control={skillBookForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2 flex flex-col gap-2">
                            <FormLabel>Status</FormLabel>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormDescription>Inactive books will be hidden from players.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="md:col-span-2 flex items-center justify-end gap-2">
                        {editingSkillBook ? (
                          <Button type="button" variant="outline" onClick={resetSkillBookForm} disabled={isSubmittingSkillBook}>
                            Reset
                          </Button>
                        ) : null}
                        <Button type="submit" disabled={isSubmittingSkillBook}>
                          {isSubmittingSkillBook ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                            </>
                          ) : editingSkillBook ? (
                            "Update Skill Book"
                          ) : (
                            "Create Skill Book"
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-xl">
                    Skill Books
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleSeedSkillBooks()}
                        disabled={isSeedingBooks || isLoadingSkillBooks}
                      >
                        {isSeedingBooks ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isSeedingBooks ? "Syncing" : "Seed from skill tree"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleFetchSkillBooks()}
                        disabled={isLoadingSkillBooks}
                        title="Refresh skill books"
                      >
                        <RefreshCcw className={`h-4 w-4 ${isLoadingSkillBooks ? "animate-spin" : ""}`} />
                        <span className="sr-only">Refresh skill books</span>
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>Review which books are purchasable in the Education hub.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingSkillBooks ? (
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading skill books...
                    </div>
                  ) : skillBooks.length === 0 ? (
                    <div className="flex flex-col gap-3 text-muted-foreground">
                      <p>No skill books are defined yet. Generate them from the skill tree to get started.</p>
                      <div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void handleSeedSkillBooks()}
                          disabled={isSeedingBooks}
                        >
                          {isSeedingBooks ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          {isSeedingBooks ? "Syncing" : "Generate skill books"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Skill</TableHead>
                          <TableHead className="hidden lg:table-cell">Track</TableHead>
                          <TableHead>Cost</TableHead>
                          <TableHead>XP</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {skillBooks.map((book) => {
                          const metadata = getSkillMetadata(book.skill_slug);
                          return (
                            <TableRow key={book.id}>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">{book.title}</span>
                                  <span className="text-xs text-muted-foreground">{metadata.name}</span>
                                  {metadata.tier ? (
                                    <Badge variant="outline" className="mt-1 w-max">{metadata.tier}</Badge>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <span className="text-sm text-muted-foreground">
                                  {metadata.track ?? metadata.category ?? "-"}
                                </span>
                              </TableCell>
                              <TableCell>{`$${Number(book.cost ?? 0).toLocaleString()}`}</TableCell>
                              <TableCell>{book.xp_value}</TableCell>
                              <TableCell>
                                <Badge variant={book.is_active ? "default" : "secondary"}>
                                  {book.is_active ? "Active" : "Hidden"}
                                </Badge>
                              </TableCell>
                              <TableCell className="flex justify-end gap-2">
                                <Button type="button" variant="outline" size="icon" onClick={() => handleEditSkillBook(book)}>
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Edit {book.title}</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => handleDeleteSkillBook(book.id, book.title)}
                                  disabled={deletingSkillBookId === book.id}
                                >
                                  {deletingSkillBookId === book.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                  <span className="sr-only">Delete {book.title}</span>
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
            </TabsContent>

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
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {hasUniversities && universities.length > 0
                        ? `Showing ${showingRangeStart}-${showingRangeEnd} of ${totalUniversities} universities.`
                        : hasUniversities
                          ? "Adjust the sorting or pagination to view the next set of universities."
                          : "Use the form above to define the first university entry."}
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Select
                        value={sortColumn}
                        onValueChange={(value) => handleSortColumnChange(value as SortColumn)}
                        disabled={!hasUniversities || isLoadingUniversities}
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Sort universities by" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortColumnOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="justify-between"
                        onClick={handleToggleSortDirection}
                        disabled={!hasUniversities || isLoadingUniversities}
                      >
                        {sortDirectionLabels[sortDirection]}
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
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
                            <TableCell className="hidden sm:table-cell">{university.prestige ?? "-"}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {university.quality_of_learning ?? "-"}
                            </TableCell>
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
                                onClick={() =>
                                  handleDelete(
                                    university.id,
                                    university.name ?? university.city ?? "this university",
                                  )
                                }
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
                  {hasUniversities && totalPages > 1 ? (
                    <Pagination className="pt-4">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              handlePageChange(page - 1);
                            }}
                            aria-disabled={page === 1}
                            tabIndex={page === 1 ? -1 : undefined}
                            className={page === 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        <PaginationItem>
                          <span className="px-3 text-sm text-muted-foreground">
                            Page {page} of {totalPages}
                          </span>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              handlePageChange(page + 1);
                            }}
                            aria-disabled={page >= totalPages}
                            tabIndex={page >= totalPages ? -1 : undefined}
                            className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  ) : null}
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
