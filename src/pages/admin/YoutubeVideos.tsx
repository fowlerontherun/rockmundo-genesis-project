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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  LESSON_DIFFICULTIES,
  LESSON_DIFFICULTY_CONFIG,
  SKILL_LABELS,
  type LessonDifficulty,
  type PrimarySkill,
} from "@/features/education/constants";

import {
  attributeOptions,
  defaultLessonFormValues,
  defaultResourceFormValues,
  lessonDifficultyOptions,
  mapLessonFormToPayload,
  mapLessonRowToFormValues,
  mapResourceFormToPayload,
  mapResourceRowToFormValues,
  skillOptions,
  youtubeLessonSchema,
  youtubeResourceSchema,
  type YoutubeLessonFormValues,
  type YoutubeLessonRow,
  type YoutubeResourceFormValues,
  type YoutubeResourceRow,
} from "./youtubeVideos.helpers";

const formatRequiredSkill = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value.toString() : "—";

const resolveSkillLabel = (skill: string) => SKILL_LABELS[skill as PrimarySkill] ?? skill;

export default function YoutubeVideosAdmin() {
  const { toast } = useToast();
  const [lessons, setLessons] = useState<YoutubeLessonRow[]>([]);
  const [resources, setResources] = useState<YoutubeResourceRow[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [isSavingLesson, setIsSavingLesson] = useState(false);
  const [isSavingResource, setIsSavingResource] = useState(false);
  const [editingLesson, setEditingLesson] = useState<YoutubeLessonRow | null>(null);
  const [editingResource, setEditingResource] = useState<YoutubeResourceRow | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [deletingResourceId, setDeletingResourceId] = useState<string | null>(null);

  const lessonForm = useForm<YoutubeLessonFormValues>({
    resolver: zodResolver(youtubeLessonSchema),
    defaultValues: defaultLessonFormValues,
  });

  const resourceForm = useForm<YoutubeResourceFormValues>({
    resolver: zodResolver(youtubeResourceSchema),
    defaultValues: defaultResourceFormValues,
  });

  const fetchLessons = useCallback(async () => {
    setIsLoadingLessons(true);
    try {
      const { data, error } = await supabase
        .from("education_youtube_lessons")
        .select("*")
        .order("skill", { ascending: true })
        .order("required_skill_value", { ascending: true, nullsFirst: true })
        .order("difficulty", { ascending: true })
        .order("title", { ascending: true });

      if (error) throw error;

      setLessons((data ?? []) as YoutubeLessonRow[]);
    } catch (error) {
      console.error("Failed to load lessons", error);
      toast({
        variant: "destructive",
        title: "Unable to load lessons",
        description: "We couldn't retrieve the curated lessons. Please try again later.",
      });
    } finally {
      setIsLoadingLessons(false);
    }
  }, [toast]);

  const fetchResources = useCallback(async () => {
    setIsLoadingResources(true);
    try {
      const { data, error } = await supabase
        .from("education_youtube_resources")
        .select("*")
        .order("collection_sort_order", { ascending: true })
        .order("collection_title", { ascending: true })
        .order("resource_sort_order", { ascending: true })
        .order("resource_name", { ascending: true });

      if (error) throw error;

      setResources((data ?? []) as YoutubeResourceRow[]);
    } catch (error) {
      console.error("Failed to load resources", error);
      toast({
        variant: "destructive",
        title: "Unable to load playlists",
        description: "We couldn't retrieve the resource playlists. Please try again later.",
      });
    } finally {
      setIsLoadingResources(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchLessons();
    void fetchResources();
  }, [fetchLessons, fetchResources]);

  useEffect(() => {
    if (editingLesson) {
      lessonForm.reset(mapLessonRowToFormValues(editingLesson));
    } else {
      lessonForm.reset(defaultLessonFormValues);
    }
  }, [editingLesson, lessonForm]);

  useEffect(() => {
    if (editingResource) {
      resourceForm.reset(mapResourceRowToFormValues(editingResource));
    } else {
      resourceForm.reset(defaultResourceFormValues);
    }
  }, [editingResource, resourceForm]);

  const skillSortOrder = useMemo(() => {
    const order = new Map<PrimarySkill, number>();
    skillOptions.forEach((option, index) => order.set(option.value, index));
    return order;
  }, []);

  const sortedLessons = useMemo(() => {
    return [...lessons].sort((a, b) => {
      const skillA = a.skill as PrimarySkill;
      const skillB = b.skill as PrimarySkill;
      const orderA = skillSortOrder.get(skillA) ?? Number.MAX_SAFE_INTEGER;
      const orderB = skillSortOrder.get(skillB) ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;

      const difficultyA = LESSON_DIFFICULTIES.indexOf(a.difficulty as LessonDifficulty);
      const difficultyB = LESSON_DIFFICULTIES.indexOf(b.difficulty as LessonDifficulty);
      if (difficultyA !== difficultyB) return difficultyA - difficultyB;

      const requiredA = a.required_skill_value ?? 0;
      const requiredB = b.required_skill_value ?? 0;
      if (requiredA !== requiredB) return requiredA - requiredB;

      const titleComparison = a.title.localeCompare(b.title);
      if (titleComparison !== 0) return titleComparison;

      return a.id.localeCompare(b.id);
    });
  }, [lessons, skillSortOrder]);

  const sortedResources = useMemo(() => {
    return [...resources].sort((a, b) => {
      if (a.collection_sort_order !== b.collection_sort_order) {
        return a.collection_sort_order - b.collection_sort_order;
      }

      const titleComparison = a.collection_title.localeCompare(b.collection_title);
      if (titleComparison !== 0) return titleComparison;

      if (a.resource_sort_order !== b.resource_sort_order) {
        return a.resource_sort_order - b.resource_sort_order;
      }

      const resourceComparison = a.resource_name.localeCompare(b.resource_name);
      if (resourceComparison !== 0) return resourceComparison;

      return a.id.localeCompare(b.id);
    });
  }, [resources]);

  const handleSubmitLesson = useCallback(
    async (values: YoutubeLessonFormValues) => {
      setIsSavingLesson(true);
      try {
        const payload = mapLessonFormToPayload(values);
        if (editingLesson) {
          const { error } = await supabase
            .from("education_youtube_lessons")
            .update(payload)
            .eq("id", editingLesson.id);

          if (error) throw error;

          toast({
            title: "Lesson updated",
            description: "Your changes to the curated lesson are live.",
          });
        } else {
          const { error } = await supabase
            .from("education_youtube_lessons")
            .insert(payload);

          if (error) throw error;

          toast({
            title: "Lesson added",
            description: "The curated lesson is now available on the education page.",
          });
        }

        setEditingLesson(null);
        lessonForm.reset(defaultLessonFormValues);
        await fetchLessons();
      } catch (error) {
        console.error("Failed to save lesson", error);
        toast({
          variant: "destructive",
          title: "Unable to save lesson",
          description: "We couldn't persist the lesson details. Please try again.",
        });
      } finally {
        setIsSavingLesson(false);
      }
    },
    [editingLesson, fetchLessons, lessonForm, toast],
  );

  const handleSubmitResource = useCallback(
    async (values: YoutubeResourceFormValues) => {
      setIsSavingResource(true);
      try {
        const payload = mapResourceFormToPayload(values);
        if (editingResource) {
          const { error } = await supabase
            .from("education_youtube_resources")
            .update(payload)
            .eq("id", editingResource.id);

          if (error) throw error;

          toast({
            title: "Resource updated",
            description: "The resource playlist entry has been refreshed.",
          });
        } else {
          const { error } = await supabase
            .from("education_youtube_resources")
            .insert(payload);

          if (error) throw error;

          toast({
            title: "Resource added",
            description: "The playlist resource is now available to players.",
          });
        }

        setEditingResource(null);
        resourceForm.reset(defaultResourceFormValues);
        await fetchResources();
      } catch (error) {
        console.error("Failed to save resource", error);
        toast({
          variant: "destructive",
          title: "Unable to save resource",
          description: "We couldn't persist the resource details. Please try again.",
        });
      } finally {
        setIsSavingResource(false);
      }
    },
    [editingResource, fetchResources, resourceForm, toast],
  );

  const handleDeleteLesson = useCallback(
    async (id: string) => {
      setDeletingLessonId(id);
      try {
        const { error } = await supabase
          .from("education_youtube_lessons")
          .delete()
          .eq("id", id);

        if (error) throw error;

        toast({
          title: "Lesson removed",
          description: "The curated lesson has been deleted.",
        });

        if (editingLesson?.id === id) {
          setEditingLesson(null);
          lessonForm.reset(defaultLessonFormValues);
        }

        await fetchLessons();
      } catch (error) {
        console.error("Failed to delete lesson", error);
        toast({
          variant: "destructive",
          title: "Unable to delete lesson",
          description: "We couldn't remove the lesson. Please try again.",
        });
      } finally {
        setDeletingLessonId(null);
      }
    },
    [editingLesson, fetchLessons, lessonForm, toast],
  );

  const handleDeleteResource = useCallback(
    async (id: string) => {
      setDeletingResourceId(id);
      try {
        const { error } = await supabase
          .from("education_youtube_resources")
          .delete()
          .eq("id", id);

        if (error) throw error;

        toast({
          title: "Resource removed",
          description: "The playlist entry has been deleted.",
        });

        if (editingResource?.id === id) {
          setEditingResource(null);
          resourceForm.reset(defaultResourceFormValues);
        }

        await fetchResources();
      } catch (error) {
        console.error("Failed to delete resource", error);
        toast({
          variant: "destructive",
          title: "Unable to delete resource",
          description: "We couldn't remove the resource. Please try again.",
        });
      } finally {
        setDeletingResourceId(null);
      }
    },
    [editingResource, fetchResources, resourceForm, toast],
  );

  const lessonFormTitle = editingLesson ? "Update lesson" : "Create lesson";
  const resourceFormTitle = editingResource ? "Update resource" : "Create resource";

  return (
    <AdminRoute>
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">YouTube education</h1>
          <p className="text-muted-foreground">
            Curate lessons and supporting playlists that surface on the Education page for every player.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Curated lessons</CardTitle>
                <CardDescription>Manage the skill-specific lessons available to players.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => void fetchLessons()} disabled={isLoadingLessons}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Skill</TableHead>
                    <TableHead>Lesson</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Attributes</TableHead>
                    <TableHead>Requirement</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingLessons ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading lessons...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : sortedLessons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                        No lessons have been added yet. Use the form to create the first entry.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedLessons.map((lesson) => {
                      const isDeleting = deletingLessonId === lesson.id;
                      return (
                        <TableRow key={lesson.id}>
                          <TableCell className="align-top font-medium">
                            {resolveSkillLabel(lesson.skill)}
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">{lesson.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {lesson.focus} • {lesson.channel}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{lesson.summary}</p>
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-sm">
                            {LESSON_DIFFICULTY_CONFIG[lesson.difficulty as LessonDifficulty]?.label ?? lesson.difficulty}
                          </TableCell>
                          <TableCell className="align-top text-sm">{lesson.duration_minutes} min</TableCell>
                          <TableCell className="align-top">
                            <div className="flex flex-wrap gap-1">
                              {(lesson.attribute_keys ?? []).length === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                lesson.attribute_keys?.map((key) => (
                                  <Badge key={`${lesson.id}-${key}`} variant="outline" className="text-xs">
                                    {attributeOptions.find((option) => option.value === key)?.label ?? key}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-sm">
                            {formatRequiredSkill(lesson.required_skill_value)}
                          </TableCell>
                          <TableCell className="align-top text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingLesson(lesson)}
                                disabled={isSavingLesson || isDeleting}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => void handleDeleteLesson(lesson.id)}
                                disabled={isDeleting || isSavingLesson}
                              >
                                {isDeleting ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="mr-2 h-4 w-4" />
                                )}
                                {isDeleting ? "Deleting" : "Delete"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{lessonFormTitle}</CardTitle>
              <CardDescription>
                {editingLesson
                  ? "Edit the selected lesson and publish the updates for players."
                  : "Add a new curated lesson aligned with a skill focus."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...lessonForm}>
                <form onSubmit={lessonForm.handleSubmit(handleSubmitLesson)} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={lessonForm.control}
                      name="skill"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Skill</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select skill" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {skillOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={lessonForm.control}
                      name="difficulty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Difficulty</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select difficulty" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {lessonDifficultyOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={lessonForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lesson title</FormLabel>
                        <FormControl>
                          <Input placeholder="Modal mastery deep dive" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={lessonForm.control}
                      name="channel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Channel</FormLabel>
                          <FormControl>
                            <Input placeholder="Rick Beato" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={lessonForm.control}
                      name="focus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lesson focus</FormLabel>
                          <FormControl>
                            <Input placeholder="Interval mapping" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={lessonForm.control}
                    name="summary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Summary</FormLabel>
                        <FormControl>
                          <Textarea rows={4} placeholder="Describe the outcomes and drills players can expect." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={lessonForm.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Video URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={lessonForm.control}
                      name="durationMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={5}
                              max={360}
                              value={Number.isNaN(field.value) ? "" : field.value}
                              onChange={(event) => field.onChange(Number(event.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={lessonForm.control}
                    name="requiredSkillValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Required skill rating</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Optional requirement"
                            value={field.value}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormDescription>Leave blank to make the lesson available to everyone.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={lessonForm.control}
                    name="attributeKeys"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Attribute tags</FormLabel>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {attributeOptions.map((option) => {
                            const checked = field.value?.includes(option.value) ?? false;
                            return (
                              <label
                                key={option.value}
                                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"
                              >
                                 <Checkbox
                                   checked={checked}
                                   onCheckedChange={(value) => {
                                     const next = new Set(field.value ?? []);
                                    if (value === true) {
                                      next.add(option.value);
                                    } else {
                                      next.delete(option.value);
                                    }
                                    field.onChange(Array.from(next));
                                  }}
                                />
                                <span>
                                  <span className="block font-medium">{option.label}</span>
                                  <span className="block text-xs text-muted-foreground">{option.description}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingLesson(null);
                        lessonForm.reset(defaultLessonFormValues);
                      }}
                      disabled={isSavingLesson}
                    >
                      Reset
                    </Button>
                    <Button type="submit" disabled={isSavingLesson}>
                      {isSavingLesson ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : editingLesson ? (
                        "Update lesson"
                      ) : (
                        "Create lesson"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Resource playlists</CardTitle>
                <CardDescription>Manage the supporting playlists that surface alongside lessons.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => void fetchResources()} disabled={isLoadingResources}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Collection</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Focus</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingResources ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading resources...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : sortedResources.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                        No playlist resources have been added yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedResources.map((resource) => {
                      const isDeleting = deletingResourceId === resource.id;
                      return (
                        <TableRow key={resource.id}>
                          <TableCell className="align-top">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">{resource.collection_title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {resource.collection_description ?? "—"}
                              </p>
                              <Badge variant="outline" className="text-xs">
                                {resource.collection_key}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">{resource.resource_name}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {resource.resource_summary}
                              </p>
                              <Button asChild variant="link" className="h-auto px-0 text-xs font-semibold">
                                <a href={resource.resource_url} target="_blank" rel="noreferrer">
                                  View
                                </a>
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-sm">{resource.resource_focus}</TableCell>
                          <TableCell className="align-top text-sm">{resource.resource_format}</TableCell>
                          <TableCell className="align-top text-sm">
                            {resource.collection_sort_order} • {resource.resource_sort_order}
                          </TableCell>
                          <TableCell className="align-top text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingResource(resource)}
                                disabled={isSavingResource || isDeleting}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => void handleDeleteResource(resource.id)}
                                disabled={isDeleting || isSavingResource}
                              >
                                {isDeleting ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="mr-2 h-4 w-4" />
                                )}
                                {isDeleting ? "Deleting" : "Delete"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{resourceFormTitle}</CardTitle>
              <CardDescription>
                {editingResource
                  ? "Update the selected playlist entry."
                  : "Add a playlist resource grouped under a collection."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...resourceForm}>
                <form onSubmit={resourceForm.handleSubmit(handleSubmitResource)} className="space-y-4">
                  <FormField
                    control={resourceForm.control}
                    name="collectionKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Collection key</FormLabel>
                        <FormControl>
                          <Input placeholder="technique-playlists" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={resourceForm.control}
                    name="collectionTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Collection title</FormLabel>
                        <FormControl>
                          <Input placeholder="Technique & Theory" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={resourceForm.control}
                    name="collectionDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Collection description</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Describe the theme for this playlist collection." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={resourceForm.control}
                    name="collectionSortOrder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Collection sort order</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            value={Number.isNaN(field.value) ? "" : field.value}
                            onChange={(event) => field.onChange(Number(event.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={resourceForm.control}
                    name="resourceName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Resource name</FormLabel>
                        <FormControl>
                          <Input placeholder="Rick Beato" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={resourceForm.control}
                      name="resourceFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Format</FormLabel>
                          <FormControl>
                            <Input placeholder="Playlist" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={resourceForm.control}
                      name="resourceFocus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Focus</FormLabel>
                          <FormControl>
                            <Input placeholder="Ear training" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={resourceForm.control}
                    name="resourceSummary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Summary</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Share why this playlist matters." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={resourceForm.control}
                    name="resourceUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://www.youtube.com/watch?v=..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={resourceForm.control}
                    name="resourceSortOrder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Resource sort order</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            value={Number.isNaN(field.value) ? "" : field.value}
                            onChange={(event) => field.onChange(Number(event.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingResource(null);
                        resourceForm.reset(defaultResourceFormValues);
                      }}
                      disabled={isSavingResource}
                    >
                      Reset
                    </Button>
                    <Button type="submit" disabled={isSavingResource}>
                      {isSavingResource ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : editingResource ? (
                        "Update resource"
                      ) : (
                        "Create resource"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
}
