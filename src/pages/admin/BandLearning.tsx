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
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { ATTRIBUTE_METADATA, type AttributeKey } from "@/utils/attributeProgression";

const FOCUS_SKILL_VALUES = [
  "guitar",
  "bass",
  "drums",
  "vocals",
  "performance",
  "songwriting"
] as const;

type FocusSkillValue = (typeof FOCUS_SKILL_VALUES)[number];

const FOCUS_SKILL_LABELS: Record<FocusSkillValue, string> = {
  guitar: "Guitar",
  bass: "Bass",
  drums: "Drums",
  vocals: "Vocals",
  performance: "Performance",
  songwriting: "Songwriting"
};

const ATTRIBUTE_KEY_VALUES = [
  "musical_ability",
  "vocal_talent",
  "rhythm_sense",
  "stage_presence",
  "creative_insight",
  "technical_mastery",
  "business_acumen",
  "marketing_savvy"
] as const satisfies readonly AttributeKey[];

type AttributeKeyValue = (typeof ATTRIBUTE_KEY_VALUES)[number];

const DIFFICULTY_VALUES = ["beginner", "intermediate", "advanced"] as const;
type DifficultyValue = (typeof DIFFICULTY_VALUES)[number];

const DIFFICULTY_LABELS: Record<DifficultyValue, string> = {
  beginner: "Foundation",
  intermediate: "Growth",
  advanced: "Expert"
};

const bandSessionSchema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().optional(),
  focusSkills: z
    .array(z.enum(FOCUS_SKILL_VALUES))
    .min(1, "Select at least one focus skill"),
  attributeKeys: z.array(z.enum(ATTRIBUTE_KEY_VALUES)).optional(),
  baseXp: z
    .coerce
    .number({ invalid_type_error: "Base XP must be a number" })
    .min(0, "Base XP cannot be negative"),
  durationMinutes: z
    .coerce
    .number({ invalid_type_error: "Duration must be a number" })
    .min(1, "Duration must be at least one minute"),
  cooldownHours: z
    .coerce
    .number({ invalid_type_error: "Cooldown must be a number" })
    .min(0, "Cooldown cannot be negative"),
  difficulty: z.enum(DIFFICULTY_VALUES),
  synergyNotes: z.string().optional()
});

type BandSessionFormValues = z.infer<typeof bandSessionSchema>;

type BandSessionRow = Tables<"education_band_sessions">;
type BandSessionInsert = TablesInsert<"education_band_sessions">;
type BandSessionUpdate = TablesUpdate<"education_band_sessions">;

const defaultFormValues: BandSessionFormValues = {
  title: "",
  description: "",
  focusSkills: [],
  attributeKeys: [],
  baseXp: 250,
  durationMinutes: 60,
  cooldownHours: 24,
  difficulty: "beginner",
  synergyNotes: ""
};

const filterFocusSkills = (skills: string[] | null | undefined): FocusSkillValue[] => {
  if (!skills) return [];
  return skills.filter((skill): skill is FocusSkillValue =>
    FOCUS_SKILL_VALUES.includes(skill as FocusSkillValue)
  );
};

const filterAttributeKeys = (keys: string[] | null | undefined): AttributeKeyValue[] => {
  if (!keys) return [];
  return keys.filter((key): key is AttributeKeyValue =>
    ATTRIBUTE_KEY_VALUES.includes(key as AttributeKeyValue)
  );
};

const isDifficultyValue = (value: string | null | undefined): value is DifficultyValue =>
  typeof value === "string" && DIFFICULTY_VALUES.includes(value as DifficultyValue);

export default function BandLearning() {
  const { toast } = useToast();
  const [bandSessions, setBandSessions] = useState<BandSessionRow[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const [editingSession, setEditingSession] = useState<BandSessionRow | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const bandSessionForm = useForm<BandSessionFormValues>({
    resolver: zodResolver(bandSessionSchema),
    defaultValues: defaultFormValues
  });

  const attributeOptions = useMemo(
    () =>
      ATTRIBUTE_KEY_VALUES.map((key) => ({
        value: key,
        label: ATTRIBUTE_METADATA[key].label
      })),
    []
  );

  const focusSkillOptions = useMemo(
    () =>
      FOCUS_SKILL_VALUES.map((value) => ({
        value,
        label: FOCUS_SKILL_LABELS[value]
      })),
    []
  );

  const fetchBandSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const { data, error } = await supabase
        .from("education_band_sessions")
        .select("*")
        .order("difficulty", { ascending: true })
        .order("title", { ascending: true });

      if (error) throw error;

      setBandSessions((data as BandSessionRow[] | null) ?? []);
    } catch (error) {
      console.error("Failed to load band sessions", error);
      toast({
        variant: "destructive",
        title: "Unable to load sessions",
        description: error instanceof Error ? error.message : "Please try again later."
      });
    } finally {
      setIsLoadingSessions(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchBandSessions();
  }, [fetchBandSessions]);

  const resetBandSessionForm = useCallback(() => {
    bandSessionForm.reset(defaultFormValues, {
      keepDefaultValues: true
    });
    setEditingSession(null);
  }, [bandSessionForm]);

  const handleEditSession = useCallback(
    (session: BandSessionRow) => {
      bandSessionForm.reset({
        title: session.title ?? "",
        description: session.description ?? "",
        focusSkills: filterFocusSkills(session.focus_skills ?? []),
        attributeKeys: filterAttributeKeys(session.attribute_keys ?? []),
        baseXp: Number.isFinite(session.base_xp) ? session.base_xp : 0,
        durationMinutes: Number.isFinite(session.duration_minutes) ? session.duration_minutes : 60,
        cooldownHours: Number.isFinite(session.cooldown_hours) ? session.cooldown_hours : 0,
        difficulty: isDifficultyValue(session.difficulty) ? session.difficulty : "beginner",
        synergyNotes: session.synergy_notes ?? ""
      });
      setEditingSession(session);
    },
    [bandSessionForm]
  );

  const handleSubmitBandSession = useCallback(
    async (values: BandSessionFormValues) => {
      setIsSubmittingSession(true);
      try {
        const payload: BandSessionInsert = {
          title: values.title.trim(),
          description: values.description?.trim() ? values.description.trim() : null,
          focus_skills: values.focusSkills,
          attribute_keys: (values.attributeKeys ?? []) as AttributeKey[],
          base_xp: values.baseXp,
          duration_minutes: values.durationMinutes,
          cooldown_hours: values.cooldownHours,
          difficulty: values.difficulty,
          synergy_notes: values.synergyNotes?.trim() ? values.synergyNotes.trim() : null
        };

        if (editingSession?.id) {
          const updatePayload: BandSessionUpdate = { ...payload };
          const { error } = await supabase
            .from("education_band_sessions")
            .update(updatePayload)
            .eq("id", editingSession.id);

          if (error) throw error;

          toast({
            title: "Band session updated",
            description: `${values.title} has been saved.`,
          });
        } else {
          const { error } = await supabase.from("education_band_sessions").insert(payload);

          if (error) throw error;

          toast({
            title: "Band session created",
            description: `${values.title} is now available in education.`,
          });
        }

        resetBandSessionForm();
        await fetchBandSessions();
      } catch (error) {
        console.error("Failed to save band session", error);
        toast({
          variant: "destructive",
          title: "Unable to save session",
          description: error instanceof Error ? error.message : "Please try again later."
        });
      } finally {
        setIsSubmittingSession(false);
      }
    },
    [editingSession?.id, fetchBandSessions, resetBandSessionForm, toast]
  );

  const handleDeleteSession = useCallback(
    async (session: BandSessionRow) => {
      if (!session.id) return;
      setDeletingSessionId(session.id);
      try {
        const { error } = await supabase
          .from("education_band_sessions")
          .delete()
          .eq("id", session.id);

        if (error) throw error;

        toast({
          title: "Band session deleted",
          description: `${session.title ?? "Session"} has been removed.`,
        });

        if (editingSession?.id === session.id) {
          resetBandSessionForm();
        }

        await fetchBandSessions();
      } catch (error) {
        console.error("Failed to delete band session", error);
        toast({
          variant: "destructive",
          title: "Unable to delete",
          description: error instanceof Error ? error.message : "Please try again later."
        });
      } finally {
        setDeletingSessionId(null);
      }
    },
    [editingSession?.id, fetchBandSessions, resetBandSessionForm, toast]
  );

  return (
    <AdminRoute>
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Band Learning Sessions</h1>
          <p className="text-muted-foreground">
            Configure the collaborative education sessions that surface in the player-facing education hub.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{editingSession ? "Update band session" : "Create band session"}</CardTitle>
              <CardDescription>
                Define the rewards, difficulty, and skill targets for each band learning intensive.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...bandSessionForm}>
                <form onSubmit={bandSessionForm.handleSubmit(handleSubmitBandSession)} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={bandSessionForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Session title</FormLabel>
                          <FormControl>
                            <Input placeholder="Sync Lock Intensive" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bandSessionForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Short blurb displayed in the education tab"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bandSessionForm.control}
                      name="focusSkills"
                      render={({ field }) => {
                        const current = new Set(field.value ?? []);
                        return (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Focus skills</FormLabel>
                            <FormDescription>Choose the primary skills that receive gains from this session.</FormDescription>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {focusSkillOptions.map((option) => {
                                const checked = current.has(option.value);
                                return (
                                  <label
                                    key={option.value}
                                    className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(state) => {
                                        const next = new Set(field.value ?? []);
                                        if (state === true) {
                                          next.add(option.value);
                                        } else {
                                          next.delete(option.value);
                                        }
                                        field.onChange(Array.from(next));
                                      }}
                                    />
                                    <span className="font-medium">{option.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <FormField
                      control={bandSessionForm.control}
                      name="attributeKeys"
                      render={({ field }) => {
                        const current = new Set(field.value ?? []);
                        return (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Attribute emphasis</FormLabel>
                            <FormDescription>Optional attributes that boost XP gains for this session.</FormDescription>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {attributeOptions.map((option) => {
                                const checked = current.has(option.value);
                                return (
                                  <label
                                    key={option.value}
                                    className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(state) => {
                                        const next = new Set(field.value ?? []);
                                        if (state === true) {
                                          next.add(option.value);
                                        } else {
                                          next.delete(option.value);
                                        }
                                        field.onChange(Array.from(next));
                                      }}
                                    />
                                    <span className="font-medium">{option.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <FormField
                      control={bandSessionForm.control}
                      name="baseXp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base XP</FormLabel>
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
                      control={bandSessionForm.control}
                      name="durationMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              step={5}
                              value={Number.isFinite(field.value) ? field.value : ""}
                              onChange={(event) => field.onChange(event.target.valueAsNumber)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bandSessionForm.control}
                      name="cooldownHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cooldown (hours)</FormLabel>
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
                      control={bandSessionForm.control}
                      name="difficulty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Difficulty</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a difficulty" />
                              </SelectTrigger>
                              <SelectContent>
                                {DIFFICULTY_VALUES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {DIFFICULTY_LABELS[value]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bandSessionForm.control}
                      name="synergyNotes"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Synergy notes</FormLabel>
                          <FormDescription>Optional tips displayed to players about maximizing rewards.</FormDescription>
                          <FormControl>
                            <Textarea placeholder="Explain how to amplify synergy bonuses" rows={3} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" disabled={isSubmittingSession}>
                      {isSubmittingSession ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving session...
                        </span>
                      ) : editingSession ? (
                        "Update session"
                      ) : (
                        "Create session"
                      )}
                    </Button>
                    {editingSession ? (
                      <Button type="button" variant="outline" onClick={resetBandSessionForm} disabled={isSubmittingSession}>
                        Cancel edit
                      </Button>
                    ) : null}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Configured sessions</CardTitle>
                <CardDescription>
                  Review existing band learning sessions and update them as balancing needs evolve.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => void fetchBandSessions()} disabled={isLoadingSessions}>
                {isLoadingSessions ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Refreshing
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCcw className="h-4 w-4" />
                    Refresh
                  </span>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingSessions ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions...
                </div>
              ) : bandSessions.length === 0 ? (
                <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                  No band sessions configured yet. Create one using the form on the left.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Difficulty</TableHead>
                        <TableHead>Focus skills</TableHead>
                        <TableHead>Attributes</TableHead>
                        <TableHead className="text-right">XP</TableHead>
                        <TableHead className="text-right">Duration</TableHead>
                        <TableHead className="text-right">Cooldown</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bandSessions.map((session) => {
                        const focusSkills = filterFocusSkills(session.focus_skills ?? []);
                        const attributeKeys = filterAttributeKeys(session.attribute_keys ?? []);
                        const difficulty = isDifficultyValue(session.difficulty)
                          ? session.difficulty
                          : "beginner";
                        return (
                          <TableRow key={session.id}>
                            <TableCell className="font-medium">{session.title}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{DIFFICULTY_LABELS[difficulty]}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {focusSkills.length > 0
                                  ? focusSkills.map((skill) => (
                                      <Badge key={skill} variant="secondary" className="text-xs">
                                        {FOCUS_SKILL_LABELS[skill]}
                                      </Badge>
                                    ))
                                  : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {attributeKeys.length > 0
                                  ? attributeKeys.map((key) => (
                                      <Badge key={key} variant="outline" className="text-xs">
                                        {ATTRIBUTE_METADATA[key].label}
                                      </Badge>
                                    ))
                                  : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{session.base_xp}</TableCell>
                            <TableCell className="text-right">{session.duration_minutes}m</TableCell>
                            <TableCell className="text-right">{session.cooldown_hours}h</TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditSession(session)}
                                  title="Edit session"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => void handleDeleteSession(session)}
                                  disabled={deletingSessionId === session.id}
                                  title="Delete session"
                                >
                                  {deletingSessionId === session.id ? (
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
}
