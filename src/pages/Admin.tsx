import React, { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookOpen, GraduationCap, Loader2, Pencil, RefreshCcw, Trash2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const universitySchema = z.object({
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
        city: string;
        prestige: number | null;
        quality_of_learning: number | null;
        course_cost: number | null;
        created_at: string | null;
      };
      Insert: {
        city: string;
        prestige?: number | null;
        quality_of_learning?: number | null;
        course_cost?: number | null;
      };
      Update: {
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
  const [universities, setUniversities] = useState<UniversityRow[]>([]);
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
      const { data, error } = await supabase
        .from("universities")
        .select("*")
        .order("city", { ascending: true });

      if (error) throw error;

      setUniversities((data as UniversityRow[] | null) ?? []);
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

  const onSubmit = useCallback(
    async (values: UniversityFormValues) => {
      setIsSubmittingUniversity(true);
      try {
        const payload: UniversityInsert = {
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
            description: `${values.city} has been updated successfully.`,
          });
        } else {
          const { error } = await supabase.from("universities").insert(payload);

          if (error) throw error;

          toast({
            title: "University created",
            description: `${values.city} is now available in the world.`,
          });
        }

        resetFormState();
        await handleFetchUniversities();
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
    [editingUniversity, handleFetchUniversities, resetFormState, toast],
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

  const handleDelete = useCallback(
    async (id: string, city: string) => {
      setDeletingUniversityId(id);
      try {
        const { error } = await supabase.from("universities").delete().eq("id", id);

        if (error) throw error;

        setUniversities((prev) => prev.filter((item) => item.id !== id));
        if (editingUniversity?.id === id) {
          resetFormState();
        }
        toast({
          title: "University deleted",
          description: `${city} has been removed from the roster.`,
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
    [editingUniversity?.id, resetFormState, toast],
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
    [editingSkillBook?.id, resetSkillBookForm, toast],
  );

  return (
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
          <Tabs defaultValue="books" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="books" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Books
              </TabsTrigger>
              <TabsTrigger value="universities" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" /> Universities
              </TabsTrigger>
            </TabsList>

            <TabsContent value="books" className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl flex items-center justify-between">
                    {skillBookFormTitle}
                    {editingSkillBook ? <Badge variant="secondary">Editing</Badge> : null}
                  </CardTitle>
                  <CardDescription>{skillBookFormDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...skillBookForm}>
                    <form onSubmit={skillBookForm.handleSubmit(onSubmitSkillBook)} className="grid gap-6 md:grid-cols-2">
                      <FormField
                        control={skillBookForm.control}
                        name="slug"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Slug</FormLabel>
                            <FormControl>
                              <Input placeholder="unique-book-slug" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={skillBookForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter book title" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={skillBookForm.control}
                        name="author"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Author</FormLabel>
                            <FormControl>
                              <Input placeholder="Author name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={skillBookForm.control}
                        name="skillSlug"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Associated Skill</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a skill" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {skillDefinitions.map((definition) => (
                                  <SelectItem key={definition.id} value={definition.slug}>
                                    {definition.display_name}
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
                        name="cost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cost</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                step={10}
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
                        name="xpReward"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>XP Reward</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} disabled />
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
                              <Textarea placeholder="Provide a short summary" className="min-h-[120px]" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="md:col-span-2 flex items-center justify-end gap-2">
                        {editingSkillBook ? (
                          <Button type="button" variant="outline" onClick={resetSkillBookForm} disabled={isSubmittingBook}>
                            Cancel
                          </Button>
                        ) : null}
                        <Button type="submit" disabled={isSubmittingBook}>
                          {isSubmittingBook ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving
                            </>
                          ) : (
                            skillBookFormTitle
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
                    Skill Books
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleFetchSkillBooks()}
                      disabled={isLoadingSkillBooks}
                    >
                      <RefreshCcw className={`h-4 w-4 ${isLoadingSkillBooks ? "animate-spin" : ""}`} />
                      <span className="sr-only">Refresh books</span>
                    </Button>
                  </CardTitle>
                  <CardDescription>Manage purchasable skill books and their rewards.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingSkillBooks ? (
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading books...
                    </div>
                  ) : skillBooks.length === 0 ? (
                    <p className="text-muted-foreground">No books have been created yet. Add one using the form above.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead className="hidden lg:table-cell">Skill</TableHead>
                          <TableHead className="hidden sm:table-cell">Cost</TableHead>
                          <TableHead className="hidden sm:table-cell">XP Unlock</TableHead>
                          <TableHead className="hidden md:table-cell">Updated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {skillBooks.map((book) => {
                          const skillLabel = skillDefinitionBySlug[book.skill_slug]?.display_name ?? book.skill_slug;
                          const timestamp = book.updated_at ?? book.created_at;
                          return (
                            <TableRow key={book.id}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span>{book.title}</span>
                                  {book.author ? (
                                    <span className="text-xs text-muted-foreground">by {book.author}</span>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">{skillLabel}</TableCell>
                              <TableCell className="hidden sm:table-cell">
                                {currencyFormatter.format(book.cost ?? 0)}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">+{book.xp_reward ?? 0} XP</TableCell>
                              <TableCell className="hidden md:table-cell">
                                {timestamp ? new Date(timestamp).toLocaleDateString() : "—"}
                              </TableCell>
                              <TableCell className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEditSkillBook(book)}
                                  title="Edit book"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => handleDeleteSkillBook(book.id, book.title)}
                                  disabled={deletingBookId === book.id}
                                  title="Delete book"
                                >
                                  {deletingBookId === book.id ? (
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
                  <Form {...universityForm}>
                    <form onSubmit={universityForm.handleSubmit(onSubmit)} className="grid gap-6 md:grid-cols-2">
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
                          <Button type="button" variant="outline" onClick={resetFormState} disabled={isSubmittingUniversity}>
                            Reset
                          </Button>
                        ) : null}
                        <Button type="submit" disabled={isSubmittingUniversity}>
                          {isSubmittingUniversity ? (
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
                            <TableCell className="hidden sm:table-cell">
                              {university.quality_of_learning ?? "-"}
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
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
