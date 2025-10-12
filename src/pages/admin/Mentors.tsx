import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  mentorSchema,
  type MentorFormValues,
  focusSkillOptions,
  difficultyOptions,
  attributeOptions,
} from "./mentors.helpers";
import { Checkbox } from "@/components/ui/checkbox";

const Mentors = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMentor, setEditingMentor] = useState<any>(null);

  const { data: mentors, isLoading } = useQuery({
    queryKey: ["education_mentors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("education_mentors")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const form = useForm<MentorFormValues>({
    resolver: zodResolver(mentorSchema),
    defaultValues: {
      name: "",
      focusSkill: "guitar",
      description: "",
      specialty: "",
      cost: 0,
      cooldownHours: 24,
      baseXp: 100,
      difficulty: "beginner",
      attributeKeys: [],
      requiredSkillValue: 0,
      skillGainRatio: 1.0,
      bonusDescription: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: MentorFormValues) => {
      const { error } = await supabase.from("education_mentors").insert({
        name: values.name,
        focus_skill: values.focusSkill,
        description: values.description,
        specialty: values.specialty,
        cost: values.cost,
        cooldown_hours: values.cooldownHours,
        base_xp: values.baseXp,
        difficulty: values.difficulty,
        attribute_keys: values.attributeKeys,
        required_skill_value: values.requiredSkillValue,
        skill_gain_ratio: values.skillGainRatio,
        bonus_description: values.bonusDescription,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["education_mentors"] });
      toast({ title: "Mentor created successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating mentor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: MentorFormValues }) => {
      const { error } = await supabase
        .from("education_mentors")
        .update({
          name: values.name,
          focus_skill: values.focusSkill,
          description: values.description,
          specialty: values.specialty,
          cost: values.cost,
          cooldown_hours: values.cooldownHours,
          base_xp: values.baseXp,
          difficulty: values.difficulty,
          attribute_keys: values.attributeKeys,
          required_skill_value: values.requiredSkillValue,
          skill_gain_ratio: values.skillGainRatio,
          bonus_description: values.bonusDescription,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["education_mentors"] });
      toast({ title: "Mentor updated successfully" });
      setIsDialogOpen(false);
      setEditingMentor(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating mentor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("education_mentors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["education_mentors"] });
      toast({ title: "Mentor deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting mentor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (mentor: any) => {
    setEditingMentor(mentor);
    form.reset({
      name: mentor.name,
      focusSkill: mentor.focus_skill,
      description: mentor.description,
      specialty: mentor.specialty,
      cost: mentor.cost,
      cooldownHours: mentor.cooldown_hours,
      baseXp: mentor.base_xp,
      difficulty: mentor.difficulty,
      attributeKeys: mentor.attribute_keys || [],
      requiredSkillValue: mentor.required_skill_value,
      skillGainRatio: mentor.skill_gain_ratio,
      bonusDescription: mentor.bonus_description,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (values: MentorFormValues) => {
    if (editingMentor) {
      updateMutation.mutate({ id: editingMentor.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const filteredMentors = mentors?.filter((mentor) =>
    mentor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mentor.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mentor Management</CardTitle>
              <CardDescription>Create and manage education mentors</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingMentor(null);
                form.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Mentor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingMentor ? "Edit Mentor" : "Create Mentor"}</DialogTitle>
                  <DialogDescription>
                    {editingMentor ? "Update mentor details" : "Add a new mentor to the system"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" {...form.register("name")} />
                      {form.formState.errors.name && (
                        <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="focusSkill">Focus Skill</Label>
                      <Controller
                        name="focusSkill"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {focusSkillOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {form.formState.errors.focusSkill && (
                        <p className="text-sm text-destructive">{form.formState.errors.focusSkill.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="difficulty">Difficulty</Label>
                      <Controller
                        name="difficulty"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {difficultyOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="specialty">Specialty</Label>
                      <Input id="specialty" {...form.register("specialty")} />
                      {form.formState.errors.specialty && (
                        <p className="text-sm text-destructive">{form.formState.errors.specialty.message}</p>
                      )}
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea id="description" {...form.register("description")} rows={3} />
                      {form.formState.errors.description && (
                        <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="cost">Cost ($)</Label>
                      <Input type="number" id="cost" {...form.register("cost")} />
                      {form.formState.errors.cost && (
                        <p className="text-sm text-destructive">{form.formState.errors.cost.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="cooldownHours">Cooldown (hours)</Label>
                      <Input type="number" id="cooldownHours" {...form.register("cooldownHours")} />
                      {form.formState.errors.cooldownHours && (
                        <p className="text-sm text-destructive">{form.formState.errors.cooldownHours.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="baseXp">Base XP</Label>
                      <Input type="number" id="baseXp" {...form.register("baseXp")} />
                      {form.formState.errors.baseXp && (
                        <p className="text-sm text-destructive">{form.formState.errors.baseXp.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="requiredSkillValue">Required Skill Level</Label>
                      <Input type="number" id="requiredSkillValue" {...form.register("requiredSkillValue")} />
                      {form.formState.errors.requiredSkillValue && (
                        <p className="text-sm text-destructive">{form.formState.errors.requiredSkillValue.message}</p>
                      )}
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="skillGainRatio">Skill Gain Ratio</Label>
                      <Input
                        type="number"
                        step="0.1"
                        id="skillGainRatio"
                        {...form.register("skillGainRatio")}
                      />
                      {form.formState.errors.skillGainRatio && (
                        <p className="text-sm text-destructive">{form.formState.errors.skillGainRatio.message}</p>
                      )}
                    </div>

                    <div className="col-span-2">
                      <Label>Attribute Boosts</Label>
                      <Controller
                        name="attributeKeys"
                        control={form.control}
                        render={({ field }) => (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {attributeOptions.map((option) => (
                              <div key={option.value} className="flex items-center space-x-2">
                                <Checkbox
                                  id={option.value}
                                  checked={field.value?.includes(option.value)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, option.value]);
                                    } else {
                                      field.onChange(current.filter((v) => v !== option.value));
                                    }
                                  }}
                                />
                                <label htmlFor={option.value} className="text-sm">
                                  {option.label}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      />
                      {form.formState.errors.attributeKeys && (
                        <p className="text-sm text-destructive">{form.formState.errors.attributeKeys.message}</p>
                      )}
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="bonusDescription">Bonus Description</Label>
                      <Textarea id="bonusDescription" {...form.register("bonusDescription")} rows={2} />
                      {form.formState.errors.bonusDescription && (
                        <p className="text-sm text-destructive">{form.formState.errors.bonusDescription.message}</p>
                      )}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        setEditingMentor(null);
                        form.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {editingMentor ? "Update" : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search mentors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {isLoading ? (
            <p>Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Focus Skill</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Base XP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMentors?.map((mentor) => (
                  <TableRow key={mentor.id}>
                    <TableCell className="font-medium">{mentor.name}</TableCell>
                    <TableCell>{mentor.focus_skill}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{mentor.difficulty}</Badge>
                    </TableCell>
                    <TableCell>${mentor.cost}</TableCell>
                    <TableCell>{mentor.base_xp} XP</TableCell>
                    <TableCell>
                      <Badge variant={mentor.is_active ? "default" : "secondary"}>
                        {mentor.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(mentor)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this mentor?")) {
                              deleteMutation.mutate(mentor.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Mentors;
