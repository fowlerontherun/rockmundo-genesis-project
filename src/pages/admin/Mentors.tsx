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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ATTRIBUTE_METADATA } from "@/utils/attributeProgression";

import {
  attributeOptions,
  difficultyOptions,
  focusSkillOptions,
  formatFocusSkill,
  mentorSchema,
  type EducationMentorInsert,
  type EducationMentorRow,
  type EducationMentorUpdate,
  type MentorFormValues,
} from "./mentors.helpers";

const DEFAULT_SKILL_GAIN_RATIO = 0.75;

const Mentors = () => {
  const { toast } = useToast();
  const [mentors, setMentors] = useState<EducationMentorRow[]>([]);
  const [isLoadingMentors, setIsLoadingMentors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMentor, setEditingMentor] = useState<EducationMentorRow | null>(null);
  const [deletingMentorId, setDeletingMentorId] = useState<string | null>(null);

  const mentorForm = useForm<MentorFormValues>({
    resolver: zodResolver(mentorSchema),
    defaultValues: {
      name: "",
      focusSkill: focusSkillOptions[0]?.value ?? "guitar",
      description: "",
      specialty: "",
      cost: 0,
      cooldownHours: 0,
      baseXp: 0,
      difficulty: difficultyOptions[0]?.value ?? "beginner",
      attributeKeys: [attributeOptions[0]?.value ?? "musical_ability"],
      requiredSkillValue: 0,
      skillGainRatio: DEFAULT_SKILL_GAIN_RATIO,
      bonusDescription: "",
    },
  });

  const formTitle = editingMentor ? "Update mentor" : "Create mentor";
  const formSubtitle = editingMentor
    ? "Adjust an existing mentor. Updates take effect immediately in the education roster."
    : "Define a new mentor with cost, cooldown, and progression tuning.";

  const hasMentors = mentors.length > 0;

  const sortedMentors = useMemo(() => {
    return [...mentors].sort((a, b) => {
      if (a.difficulty !== b.difficulty) {
        return a.difficulty.localeCompare(b.difficulty);
      }
      if (a.cost !== b.cost) {
        return a.cost - b.cost;
      }
      return a.name.localeCompare(b.name);
    });
  }, [mentors]);

  const resetMentorForm = useCallback(() => {
    mentorForm.reset({
      name: "",
      focusSkill: focusSkillOptions[0]?.value ?? "guitar",
      description: "",
      specialty: "",
      cost: 0,
      cooldownHours: 0,
      baseXp: 0,
      difficulty: difficultyOptions[0]?.value ?? "beginner",
      attributeKeys: [attributeOptions[0]?.value ?? "musical_ability"],
      requiredSkillValue: 0,
      skillGainRatio: DEFAULT_SKILL_GAIN_RATIO,
      bonusDescription: "",
    });
    setEditingMentor(null);
  }, [mentorForm]);

  const handleFetchMentors = useCallback(async () => {
    setIsLoadingMentors(true);
    try {
      const { data, error } = await supabase
        .from("education_mentors")
        .select("*")
        .order("difficulty", { ascending: true })
        .order("cost", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      setMentors((data as EducationMentorRow[] | null) ?? []);
    } catch (error) {
      console.error("Failed to load mentors", error);
      toast({
        variant: "destructive",
        title: "Unable to load mentors",
        description: "We couldn't fetch the mentor roster. Please try again later.",
      });
    } finally {
      setIsLoadingMentors(false);
    }
  }, [toast]);

  useEffect(() => {
    void handleFetchMentors();
  }, [handleFetchMentors]);

  const handleSubmitMentor = useCallback(
    async (values: MentorFormValues) => {
      setIsSubmitting(true);
      const isEditing = Boolean(editingMentor);
      const editingId = editingMentor?.id;

      try {
        const payload: EducationMentorInsert = {
          name: values.name.trim(),
          focus_skill: values.focusSkill,
          description: values.description.trim(),
          specialty: values.specialty.trim(),
          cost: values.cost,
          cooldown_hours: values.cooldownHours,
          base_xp: values.baseXp,
          difficulty: values.difficulty,
          attribute_keys: values.attributeKeys,
          required_skill_value: values.requiredSkillValue,
          skill_gain_ratio: values.skillGainRatio,
          bonus_description: values.bonusDescription.trim(),
        };

        if (isEditing && editingId) {
          const updatePayload: EducationMentorUpdate = { ...payload };
          const { error } = await supabase
            .from("education_mentors")
            .update(updatePayload)
            .eq("id", editingId);

          if (error) throw error;

          toast({
            title: "Mentor updated",
            description: `${values.name} has been saved.`,
          });
        } else {
          const { error } = await supabase.from("education_mentors").insert(payload);

          if (error) throw error;

          toast({
            title: "Mentor created",
            description: `${values.name} is now available in education.`,
          });
        }

        resetMentorForm();
        await handleFetchMentors();
      } catch (error) {
        console.error("Failed to save mentor", error);
        toast({
          variant: "destructive",
          title: "Save failed",
          description: "We couldn't save the mentor. Please try again.",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingMentor, handleFetchMentors, resetMentorForm, toast],
  );

  const handleEditMentor = useCallback(
    (mentor: EducationMentorRow) => {
      setEditingMentor(mentor);
      const parsedSkillGainRatio =
        typeof mentor.skill_gain_ratio === "number"
          ? mentor.skill_gain_ratio
          : Number(mentor.skill_gain_ratio);

      mentorForm.reset({
        name: mentor.name ?? "",
        focusSkill: (mentor.focus_skill as MentorFormValues["focusSkill"]) ?? focusSkillOptions[0]?.value ?? "guitar",
        description: mentor.description ?? "",
        specialty: mentor.specialty ?? "",
        cost: mentor.cost ?? 0,
        cooldownHours: mentor.cooldown_hours ?? 0,
        baseXp: mentor.base_xp ?? 0,
        difficulty: (mentor.difficulty as MentorFormValues["difficulty"]) ?? difficultyOptions[0]?.value ?? "beginner",
        attributeKeys: Array.isArray(mentor.attribute_keys) && mentor.attribute_keys.length > 0
          ? (mentor.attribute_keys as MentorFormValues["attributeKeys"])
          : [attributeOptions[0]?.value ?? "musical_ability"],
        requiredSkillValue: mentor.required_skill_value ?? 0,
        skillGainRatio:
          Number.isFinite(parsedSkillGainRatio) && parsedSkillGainRatio > 0
            ? Number(parsedSkillGainRatio)
            : DEFAULT_SKILL_GAIN_RATIO,
        bonusDescription: mentor.bonus_description ?? "",
      });
    },
    [mentorForm],
  );

  const handleDeleteMentor = useCallback(
    async (mentor: EducationMentorRow) => {
      setDeletingMentorId(mentor.id);
      try {
        const { error } = await supabase.from("education_mentors").delete().eq("id", mentor.id);

        if (error) throw error;

        toast({
          title: "Mentor removed",
          description: `${mentor.name} has been deleted from the roster.`,
        });

        if (editingMentor?.id === mentor.id) {
          resetMentorForm();
        }

        await handleFetchMentors();
      } catch (error) {
        console.error("Failed to delete mentor", error);
        toast({
          variant: "destructive",
          title: "Deletion failed",
          description: "We couldn't delete the mentor. Please try again.",
        });
      } finally {
        setDeletingMentorId(null);
      }
    },
    [editingMentor, handleFetchMentors, resetMentorForm, toast],
  );

  const renderAttributeBadges = (keys: string[] | null | undefined) => {
    if (!Array.isArray(keys) || keys.length === 0) {
      return <span className="text-xs text-muted-foreground">—</span>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {keys.map((key) => {
          const metadata = ATTRIBUTE_METADATA[key as keyof typeof ATTRIBUTE_METADATA];
          const label = metadata?.label ?? key;
          return (
            <Badge key={key} variant="outline" className="text-[11px]">
              {label}
            </Badge>
          );
        })}
      </div>
    );
  };

  const renderSkillGainRatio = (ratio: unknown) => {
    const numericValue = typeof ratio === "number" ? ratio : Number(ratio);
    if (!Number.isFinite(numericValue)) {
      return "—";
    }
    return numericValue.toFixed(2);
  };

  return (
    <AdminRoute>
      <div className="container mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Mentor Management</h1>
            <p className="text-muted-foreground text-sm">
              Curate the education mentor roster and adjust progression tuning across XP, cooldowns, and prerequisites.
            </p>
          </div>
          <Button variant="outline" onClick={() => void handleFetchMentors()} disabled={isLoadingMentors}>
            {isLoadingMentors ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refreshing
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" /> Refresh roster
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{formTitle}</CardTitle>
              <CardDescription>{formSubtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...mentorForm}>
                <form onSubmit={mentorForm.handleSubmit(handleSubmitMentor)} className="space-y-4">
                  <FormField
                    control={mentorForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Mentor name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={mentorForm.control}
                      name="focusSkill"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Focus skill</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select skill" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {focusSkillOptions.map((option) => (
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
                      control={mentorForm.control}
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
                              {difficultyOptions.map((option) => (
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
                    control={mentorForm.control}
                    name="specialty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specialty</FormLabel>
                        <FormControl>
                          <Input placeholder="Stagecraft architect" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={mentorForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Describe the mentor's program" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={mentorForm.control}
                    name="attributeKeys"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Attribute focus</FormLabel>
                        <div className="grid gap-2">
                          {attributeOptions.map((option) => {
                            const checked = field.value?.includes(option.value) ?? false;
                            const metadata = ATTRIBUTE_METADATA[option.value as keyof typeof ATTRIBUTE_METADATA];
                            return (
                              <label
                                key={option.value}
                                className="flex items-start gap-2 rounded-lg border bg-muted/20 p-2 text-xs"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(checkedState) => {
                                    const next = new Set(field.value ?? []);
                                    if (checkedState === true) {
                                      next.add(option.value);
                                    } else {
                                      next.delete(option.value);
                                    }
                                    field.onChange(Array.from(next));
                                  }}
                                />
                                <span className="space-y-1">
                                  <span className="block font-medium text-foreground">
                                    {metadata?.label ?? option.label}
                                  </span>
                                  <span className="block text-muted-foreground">
                                    {metadata?.description ?? "Attribute contributes to mentor effectiveness."}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={mentorForm.control}
                      name="cost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Session cost ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step={100}
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mentorForm.control}
                      name="cooldownHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cooldown (hours)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step={6}
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={mentorForm.control}
                      name="baseXp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base XP</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step={10}
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={mentorForm.control}
                      name="requiredSkillValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Required skill</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step={10}
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(event.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={mentorForm.control}
                    name="skillGainRatio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Skill gain ratio</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0.01}
                            step={0.05}
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={mentorForm.control}
                    name="bonusDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bonus description</FormLabel>
                        <FormControl>
                          <Textarea rows={2} placeholder="Describe the session bonus" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                        </>
                      ) : (
                        editingMentor ? "Update mentor" : "Create mentor"
                      )}
                    </Button>
                    {editingMentor ? (
                      <Button type="button" variant="ghost" onClick={resetMentorForm} disabled={isSubmitting}>
                        Cancel editing
                      </Button>
                    ) : null}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Current mentors</CardTitle>
                <CardDescription>
                  Manage mentor availability, XP rewards, and progression requirements used in the education experience.
                </CardDescription>
              </div>
              {isLoadingMentors ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : null}
            </CardHeader>
            <CardContent>
              {hasMentors ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Focus</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Base XP</TableHead>
                      <TableHead>Cooldown</TableHead>
                      <TableHead>Required skill</TableHead>
                      <TableHead>Skill ratio</TableHead>
                      <TableHead>Attributes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMentors.map((mentor) => (
                      <TableRow key={mentor.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{mentor.name}</span>
                            <span className="text-xs text-muted-foreground">{mentor.specialty}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[11px]">
                            {formatFocusSkill(mentor.focus_skill as MentorFormValues["focusSkill"])}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize text-sm">{mentor.difficulty}</TableCell>
                        <TableCell className="text-sm">${mentor.cost.toLocaleString()}</TableCell>
                        <TableCell className="text-sm">{mentor.base_xp}</TableCell>
                        <TableCell className="text-sm">{mentor.cooldown_hours}h</TableCell>
                        <TableCell className="text-sm">{mentor.required_skill_value}</TableCell>
                        <TableCell className="text-sm">{renderSkillGainRatio(mentor.skill_gain_ratio)}</TableCell>
                        <TableCell>{renderAttributeBadges(mentor.attribute_keys)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditMentor(mentor)}
                              aria-label={`Edit ${mentor.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void handleDeleteMentor(mentor)}
                              aria-label={`Delete ${mentor.name}`}
                              disabled={deletingMentorId === mentor.id}
                            >
                              {deletingMentorId === mentor.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : isLoadingMentors ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading mentors...
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  No mentors have been configured yet. Create one to populate the education roster.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
};

export default Mentors;
