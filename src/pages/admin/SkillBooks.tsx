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
  FormDescription,
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

import { currencyFormatter } from "./shared";
import {
  BOOK_XP_VALUE,
  SkillBookFormValues,
  SkillBookInsert,
  SkillBookRow,
  SkillBookUpdate,
  SkillDefinitionRow,
  SkillMetadata,
  SkillOption,
  buildSeedRecords,
  buildSkillOptions,
  buildSkillTreeMetadata,
  indexSkillDefinitions,
  resolveSkillMetadata,
  skillBookSchema,
} from "./skillBooks.helpers";

export default function SkillBooks() {
  const { toast } = useToast();
  const [skillBooks, setSkillBooks] = useState<SkillBookRow[]>([]);
  const [skillDefinitions, setSkillDefinitions] = useState<SkillDefinitionRow[]>([]);
  const [isLoadingSkillBooks, setIsLoadingSkillBooks] = useState(false);
  const [isSubmittingSkillBook, setIsSubmittingSkillBook] = useState(false);
  const [editingSkillBook, setEditingSkillBook] = useState<SkillBookRow | null>(null);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
  const [isSeedingBooks, setIsSeedingBooks] = useState(false);

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

  const skillTreeMetadata = useMemo(() => buildSkillTreeMetadata(), []);
  const skillDefinitionBySlug = useMemo(
    () => indexSkillDefinitions(skillDefinitions),
    [skillDefinitions],
  );
  const skillOptions = useMemo<SkillOption[]>(
    () => buildSkillOptions(skillDefinitions, skillTreeMetadata),
    [skillDefinitions, skillTreeMetadata],
  );

  const getSkillMetadata = useCallback(
    (skillSlug: string): SkillMetadata =>
      resolveSkillMetadata(skillSlug, skillDefinitionBySlug, skillTreeMetadata),
    [skillDefinitionBySlug, skillTreeMetadata],
  );

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
        .select("id, slug, display_name, metadata, description")
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

  useEffect(() => {
    void handleFetchSkillDefinitions();
    void handleFetchSkillBooks();
  }, [handleFetchSkillDefinitions, handleFetchSkillBooks]);

  const handleSubmitSkillBook = useCallback(
    async (values: SkillBookFormValues) => {
      setIsSubmittingSkillBook(true);
      const isEditing = Boolean(editingSkillBook);
      const editingId = editingSkillBook?.id;

      try {
        const payload: SkillBookInsert = {
          skill_slug: values.skillSlug,
          title: values.title,
          description: values.description.trim() ? values.description.trim() : null,
          cost: values.cost,
          xp_value: values.xpValue,
          is_active: values.isActive,
        };

        if (isEditing && editingId) {
          const updatePayload: SkillBookUpdate = { ...payload };
          const { error } = await supabase
            .from("skill_books")
            .update(updatePayload)
            .eq("id", editingId);

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

  const handleEditSkillBook = useCallback(
    (book: SkillBookRow) => {
      setEditingSkillBook(book);
      const parsedCost =
        typeof book.cost === "number"
          ? book.cost
          : Number.isNaN(Number(book.cost))
            ? 0
            : Number(book.cost ?? 0);

      const parsedXp =
        typeof book.xp_value === "number"
          ? book.xp_value
          : Number.isNaN(Number(book.xp_value))
            ? BOOK_XP_VALUE
            : Number(book.xp_value ?? BOOK_XP_VALUE);

      skillBookForm.reset({
        skillSlug: book.skill_slug,
        title: book.title,
        description: book.description ?? "",
        cost: parsedCost,
        xpValue: parsedXp,
        isActive: Boolean(book.is_active ?? true),
      });
    },
    [skillBookForm],
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

  const handleSeedSkillBooks = useCallback(async () => {
    setIsSeedingBooks(true);
    try {
      const records: SkillBookInsert[] = buildSeedRecords();

      const { error } = await supabase
        .from("skill_books")
        .upsert(records, { onConflict: "skill_slug" });

      if (error) throw error;

      toast({
        title: "Skill books synced",
        description: "Skill books have been aligned with the skill tree definitions.",
      });

      await handleFetchSkillBooks();
    } catch (error) {
      console.error("Failed to seed skill books", error);
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: "We couldn't generate the skill books. Please try again.",
      });
    } finally {
      setIsSeedingBooks(false);
    }
  }, [handleFetchSkillBooks, toast]);

  const formTitle = editingSkillBook ? "Update Skill Book" : "Create Skill Book";
  const formDescription = editingSkillBook
    ? "Adjust the selected book's details or align it with a different skill unlock."
    : "Add a new book that players can purchase to unlock skills.";

  return (
    <AdminRoute>
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Skill Books</h1>
          <p className="text-muted-foreground">
            Configure purchasable books that unlock skills and grant experience to players.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-xl">
              {formTitle}
              {editingSkillBook ? <Badge variant="secondary">Editing</Badge> : null}
            </CardTitle>
            <CardDescription>{formDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...skillBookForm}>
              <form
                onSubmit={skillBookForm.handleSubmit(handleSubmitSkillBook)}
                className="grid gap-6 md:grid-cols-2"
              >
                <FormField
                  control={skillBookForm.control}
                  name="skillSlug"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Skill</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={skillOptions.length === 0}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a skill" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {skillOptions.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              No skill definitions available. Load definitions to continue.
                            </div>
                          ) : (
                            skillOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex flex-col">
                                  <span>{option.name}</span>
                                  {option.track || option.tier ? (
                                    <span className="text-xs text-muted-foreground">
                                      {[option.track, option.tier].filter(Boolean).join(" · ")}
                                    </span>
                                  ) : null}
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose which skill unlocks when players purchase this book.
                      </FormDescription>
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
                        <Textarea placeholder="Optional blurb shown to players" rows={3} {...field} />
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetSkillBookForm}
                      disabled={isSubmittingSkillBook}
                    >
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
                              <Badge variant="outline" className="mt-1 w-max">
                                {metadata.tier}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {metadata.track ?? metadata.category ?? "-"}
                          </span>
                        </TableCell>
                        <TableCell>{currencyFormatter.format(Number(book.cost ?? 0))}</TableCell>
                        <TableCell>{Number(book.xp_value ?? BOOK_XP_VALUE)}</TableCell>
                        <TableCell>
                          <Badge variant={book.is_active ? "default" : "secondary"}>
                            {book.is_active ? "Active" : "Hidden"}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditSkillBook(book)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit {book.title}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDeleteSkillBook(book.id, book.title)}
                            disabled={deletingBookId === book.id}
                          >
                            {deletingBookId === book.id ? (
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
      </div>
    </AdminRoute>
  );
}
