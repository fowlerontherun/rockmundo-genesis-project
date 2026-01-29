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
import { Plus, Edit, Trash2, Search, MapPin, Calendar, Music, Building, Sparkles } from "lucide-react";
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

const DAY_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const DISCOVERY_TYPE_OPTIONS = [
  { value: "automatic", label: "Automatic (Starter)" },
  { value: "exploration", label: "City Exploration" },
  { value: "venue_gig", label: "Play at Venue" },
  { value: "studio_session", label: "Use Studio" },
];

const Mentors = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMentor, setEditingMentor] = useState<any>(null);

  // Extended form state for new fields - must be before queries that use them
  const [cityId, setCityId] = useState<string | null>(null);
  const [availableDay, setAvailableDay] = useState<string | null>(null);
  const [loreBiography, setLoreBiography] = useState("");
  const [loreAchievement, setLoreAchievement] = useState("");
  const [discoveryHint, setDiscoveryHint] = useState("");
  const [discoveryType, setDiscoveryType] = useState<string>("exploration");
  const [discoveryVenueId, setDiscoveryVenueId] = useState<string | null>(null);
  const [discoveryStudioId, setDiscoveryStudioId] = useState<string | null>(null);

  const resetExtendedFields = () => {
    setCityId(null);
    setAvailableDay(null);
    setLoreBiography("");
    setLoreAchievement("");
    setDiscoveryHint("");
    setDiscoveryType("exploration");
    setDiscoveryVenueId(null);
    setDiscoveryStudioId(null);
  };

  // Fetch cities for dropdown
  const { data: cities } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, country")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch venues for discovery trigger dropdown
  const { data: venues } = useQuery({
    queryKey: ["venues-for-mentors", cityId],
    queryFn: async () => {
      let query = supabase
        .from("venues")
        .select("id, name, city_id, cities:city_id(name)")
        .order("name");
      if (cityId) {
        query = query.eq("city_id", cityId);
      }
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
    enabled: true,
  });

  // Fetch studios for discovery trigger dropdown
  const { data: studios } = useQuery({
    queryKey: ["studios-for-mentors", cityId],
    queryFn: async () => {
      let query = supabase
        .from("city_studios")
        .select("id, name, city_id, cities:city_id(name)")
        .order("name");
      if (cityId) {
        query = query.eq("city_id", cityId);
      }
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
    enabled: true,
  });

  const { data: mentors, isLoading } = useQuery({
    queryKey: ["education_mentors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("education_mentors")
        .select(`
          *,
          city:cities(id, name, country)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const form = useForm<MentorFormValues>({
    resolver: zodResolver(mentorSchema),
    defaultValues: {
      name: "",
      focusSkill: focusSkillOptions[0]?.value ?? "",
      description: "",
      specialty: "",
      cost: 15000,
      cooldownHours: 168, // 1 week
      baseXp: 500,
      difficulty: "advanced",
      attributeKeys: [],
      requiredSkillValue: 0,
      skillGainRatio: 2.0,
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
        required_skill_value: 0,
        skill_gain_ratio: values.skillGainRatio,
        bonus_description: values.bonusDescription,
        city_id: cityId || null,
        available_day: availableDay ? parseInt(availableDay) : null,
        lore_biography: loreBiography || null,
        lore_achievement: loreAchievement || null,
        discovery_hint: discoveryHint || null,
        discovery_type: discoveryType || 'exploration',
        discovery_venue_id: discoveryType === 'venue_gig' ? discoveryVenueId : null,
        discovery_studio_id: discoveryType === 'studio_session' ? discoveryStudioId : null,
        is_discoverable: discoveryType !== 'automatic',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["education_mentors"] });
      toast({ title: "Master created successfully" });
      setIsDialogOpen(false);
      form.reset();
      resetExtendedFields();
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating master",
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
          required_skill_value: 0,
          skill_gain_ratio: values.skillGainRatio,
          bonus_description: values.bonusDescription,
          city_id: cityId || null,
          available_day: availableDay ? parseInt(availableDay) : null,
          lore_biography: loreBiography || null,
          lore_achievement: loreAchievement || null,
          discovery_hint: discoveryHint || null,
          discovery_type: discoveryType || 'exploration',
          discovery_venue_id: discoveryType === 'venue_gig' ? discoveryVenueId : null,
          discovery_studio_id: discoveryType === 'studio_session' ? discoveryStudioId : null,
          is_discoverable: discoveryType !== 'automatic',
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["education_mentors"] });
      toast({ title: "Master updated successfully" });
      setIsDialogOpen(false);
      setEditingMentor(null);
      form.reset();
      resetExtendedFields();
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating master",
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
      toast({ title: "Master deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting master",
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
    setCityId(mentor.city_id || null);
    setAvailableDay(mentor.available_day?.toString() || null);
    setLoreBiography(mentor.lore_biography || "");
    setLoreAchievement(mentor.lore_achievement || "");
    setDiscoveryHint(mentor.discovery_hint || "");
    setDiscoveryType(mentor.discovery_type || "exploration");
    setDiscoveryVenueId(mentor.discovery_venue_id || null);
    setDiscoveryStudioId(mentor.discovery_studio_id || null);
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
              <CardTitle>Legendary Masters Management</CardTitle>
              <CardDescription>Create and manage legendary masters with city locations and availability</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingMentor(null);
                form.reset();
                resetExtendedFields();
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Master
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingMentor ? "Edit Master" : "Create Master"}</DialogTitle>
                  <DialogDescription>
                    {editingMentor ? "Update master details" : "Add a new legendary master"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" {...form.register("name")} placeholder="e.g., Marcus Stone" />
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

                    {/* New: City Selection */}
                    <div>
                      <Label>
                        <MapPin className="inline h-3 w-3 mr-1" />
                        City Location
                      </Label>
                      <Select value={cityId || ""} onValueChange={(v) => setCityId(v || null)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select city..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No specific city</SelectItem>
                          {cities?.map((city) => (
                            <SelectItem key={city.id} value={city.id}>
                              {city.name}, {city.country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* New: Available Day */}
                    <div>
                      <Label>
                        <Calendar className="inline h-3 w-3 mr-1" />
                        Available Day
                      </Label>
                      <Select value={availableDay || ""} onValueChange={(v) => setAvailableDay(v || null)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any day..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Any day</SelectItem>
                          {DAY_OPTIONS.map((day) => (
                            <SelectItem key={day.value} value={day.value}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="specialty">Specialty</Label>
                      <Input id="specialty" {...form.register("specialty")} placeholder="e.g., Fingerstyle guitar legend" />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea id="description" {...form.register("description")} rows={2} />
                    </div>

                    {/* New: Lore Biography */}
                    <div className="col-span-2">
                      <Label htmlFor="loreBiography">Lore / Biography</Label>
                      <Textarea 
                        id="loreBiography" 
                        value={loreBiography}
                        onChange={(e) => setLoreBiography(e.target.value)}
                        rows={2}
                        placeholder="A legendary guitarist who toured with..."
                      />
                    </div>

                    {/* New: Discovery Hint */}
                    <div className="col-span-2">
                      <Label htmlFor="discoveryHint">Discovery Hint (shown to undiscovered)</Label>
                      <Textarea 
                        id="discoveryHint" 
                        value={discoveryHint}
                        onChange={(e) => setDiscoveryHint(e.target.value)}
                        rows={2}
                        placeholder="They say a guitar legend teaches in the jazz clubs of Nashville..."
                      />
                    </div>

                    {/* Discovery Type */}
                    <div>
                      <Label>
                        <Sparkles className="inline h-3 w-3 mr-1" />
                        Discovery Type
                      </Label>
                      <Select value={discoveryType} onValueChange={setDiscoveryType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DISCOVERY_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Discovery Venue (only shown when venue_gig selected) */}
                    {discoveryType === 'venue_gig' && (
                      <div>
                        <Label>
                          <Music className="inline h-3 w-3 mr-1" />
                          Discovery Venue
                        </Label>
                        <Select value={discoveryVenueId || ""} onValueChange={(v) => setDiscoveryVenueId(v || null)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select venue..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No venue</SelectItem>
                            {venues?.map((venue: any) => (
                              <SelectItem key={venue.id} value={venue.id}>
                                {venue.name} ({venue.cities?.name || 'Unknown'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Discovery Studio (only shown when studio_session selected) */}
                    {discoveryType === 'studio_session' && (
                      <div>
                        <Label>
                          <Building className="inline h-3 w-3 mr-1" />
                          Discovery Studio
                        </Label>
                        <Select value={discoveryStudioId || ""} onValueChange={(v) => setDiscoveryStudioId(v || null)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select studio..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No studio</SelectItem>
                            {studios?.map((studio: any) => (
                              <SelectItem key={studio.id} value={studio.id}>
                                {studio.name} ({studio.cities?.name || 'Unknown'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="cost">Cost ($)</Label>
                      <Input type="number" id="cost" {...form.register("cost")} />
                    </div>

                    <div>
                      <Label htmlFor="cooldownHours">Cooldown (hours)</Label>
                      <Input type="number" id="cooldownHours" {...form.register("cooldownHours")} />
                    </div>

                    <div>
                      <Label htmlFor="baseXp">Base XP</Label>
                      <Input type="number" id="baseXp" {...form.register("baseXp")} />
                    </div>

                    <div>
                      <Label htmlFor="skillGainRatio">Skill Gain Ratio</Label>
                      <Input type="number" step="0.1" id="skillGainRatio" {...form.register("skillGainRatio")} />
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
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="bonusDescription">Bonus Description</Label>
                      <Textarea id="bonusDescription" {...form.register("bonusDescription")} rows={2} />
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
                        resetExtendedFields();
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
                placeholder="Search masters..."
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
                  <TableHead>City</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Discovery</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMentors?.map((mentor) => (
                  <TableRow key={mentor.id}>
                    <TableCell className="font-medium">{mentor.name}</TableCell>
                    <TableCell className="text-xs">{mentor.focus_skill}</TableCell>
                    <TableCell>
                      {mentor.city ? (
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />
                          {mentor.city.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Any</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {mentor.available_day !== null ? (
                        <Badge variant="secondary" className="text-xs">
                          {DAY_OPTIONS.find(d => d.value === mentor.available_day?.toString())?.label || 'Unknown'}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Any</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={mentor.discovery_type === 'automatic' ? 'default' : 
                                mentor.discovery_type === 'venue_gig' ? 'secondary' :
                                mentor.discovery_type === 'studio_session' ? 'outline' : 'outline'}
                        className="text-xs"
                      >
                        {mentor.discovery_type === 'automatic' && <Sparkles className="h-3 w-3 mr-1" />}
                        {mentor.discovery_type === 'venue_gig' && <Music className="h-3 w-3 mr-1" />}
                        {mentor.discovery_type === 'studio_session' && <Building className="h-3 w-3 mr-1" />}
                        {DISCOVERY_TYPE_OPTIONS.find(d => d.value === mentor.discovery_type)?.label || 'Exploration'}
                      </Badge>
                    </TableCell>
                    <TableCell>${mentor.cost.toLocaleString()}</TableCell>
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
                            if (confirm("Are you sure you want to delete this master?")) {
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
