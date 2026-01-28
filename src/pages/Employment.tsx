import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Clock, DollarSign, Heart, Star, Zap, Calendar, TrendingUp, CalendarCheck, Filter, MapPin, Search, Building2, History } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import type { Database } from "@/lib/supabase-types";
import { computePlayerLevel } from "@/hooks/usePlayerLevel";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"] & {
  cities?: { name: string; country: string } | null;
};
type EmploymentWithJob = Database["public"]["Tables"]["player_employment"]["Row"] & {
  jobs: JobRow | null;
};
type ShiftHistoryWithJob = Database["public"]["Tables"]["shift_history"]["Row"] & {
  jobs: Pick<JobRow, "title" | "company_name"> | null;
};

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "food_service", label: "Food Service" },
  { value: "retail", label: "Retail" },
  { value: "music_industry", label: "Music Industry" },
  { value: "entertainment", label: "Entertainment" },
  { value: "hospitality", label: "Hospitality" },
  { value: "service", label: "Service" },
  { value: "manual_labor", label: "Manual Labor" },
];

function getHealthColor(impact: number): string {
  if (impact >= 0) return "text-green-600";
  if (impact >= -5) return "text-yellow-600";
  if (impact >= -10) return "text-orange-600";
  return "text-red-600";
}

function getHealthBadgeVariant(impact: number): "default" | "secondary" | "destructive" | "outline" {
  if (impact >= 0) return "default";
  if (impact >= -5) return "secondary";
  if (impact >= -10) return "outline";
  return "destructive";
}

export default function Employment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("current");
  const [wageRange, setWageRange] = useState<number[]>([0, 100]);
  const [activeTab, setActiveTab] = useState("jobs");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("*, cities:current_city_id(id, name, country)")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch XP wallet for level calculation
  const { data: xpWallet } = useQuery({
    queryKey: ["xp-wallet-employment", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from("player_xp_wallet")
        .select("*")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch skill progress for level calculation
  const { data: skillProgress } = useQuery({
    queryKey: ["skill-progress-employment", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("skill_progress")
        .select("skill_slug, current_level, current_xp")
        .eq("profile_id", profile.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  // Calculate player level from combined progress
  const playerLevel = useMemo(() => {
    const skills: Record<string, number> = {};
    for (const row of skillProgress ?? []) {
      if (row.skill_slug && typeof row.current_level === 'number') {
        skills[row.skill_slug] = row.current_level;
      }
    }
    const levelData = computePlayerLevel({
      xpWallet: xpWallet ?? null,
      skills,
      fame: profile?.fame ?? 0,
      attributeStars: 0,
    });
    return levelData.level;
  }, [xpWallet, skillProgress, profile?.fame]);

  const currentCityId = profile?.current_city_id;
  const currentCityName = (profile as any)?.cities?.name;

  const { data: cities } = useQuery({
    queryKey: ["cities-for-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, country")
        .order("country")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: currentEmployment } = useQuery<EmploymentWithJob | null>({
    queryKey: ["current-employment", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data, error } = await supabase
        .from("player_employment")
        .select(`*, jobs (*, cities:city_id(name, country))`)
        .eq("profile_id", profile.id)
        .eq("status", "employed")
        .maybeSingle();

      if (error) throw error;
      return data as EmploymentWithJob | null;
    },
    enabled: !!profile?.id,
  });

  const { data: shiftHistory } = useQuery<ShiftHistoryWithJob[]>({
    queryKey: ["shift-history", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [] as ShiftHistoryWithJob[];

      const { data, error } = await supabase
        .from("shift_history")
        .select(`*, jobs (title, company_name)`)
        .eq("profile_id", profile.id)
        .order("shift_date", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as ShiftHistoryWithJob[];
    },
    enabled: !!profile?.id,
  });

  const { data: availableJobs } = useQuery<JobRow[]>({
    queryKey: ["available-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, cities:city_id(name, country)")
        .eq("is_active", true)
        .order("hourly_wage", { ascending: false });

      if (error) throw error;
      return (data ?? []) as JobRow[];
    },
  });

  const { data: activityStatus } = useQuery({
    queryKey: ["activity-status", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data, error } = await supabase
        .from("profile_activity_statuses")
        .select("*")
        .eq("profile_id", profile.id)
        .eq("status", "active")
        .eq("activity_type", "work_shift")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const filteredJobs = useMemo<JobRow[]>(() => {
    if (!availableJobs) return [];
    
    return availableJobs.filter((job) => {
      // City filter
      if (cityFilter === "current" && currentCityId) {
        if (job.city_id !== currentCityId) return false;
      } else if (cityFilter !== "all" && cityFilter !== "current") {
        if (job.city_id !== cityFilter) return false;
      }
      
      // Category filter
      if (categoryFilter !== "all" && job.category !== categoryFilter) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = job.title.toLowerCase().includes(query);
        const matchesCompany = job.company_name?.toLowerCase().includes(query);
        const matchesCategory = job.category?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesCompany && !matchesCategory) return false;
      }
      
      // Wage filter
      if (job.hourly_wage < wageRange[0] || job.hourly_wage > wageRange[1]) return false;
      
      return true;
    });
  }, [availableJobs, cityFilter, currentCityId, categoryFilter, searchQuery, wageRange]);

  const applyForJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      if (!profile?.id) throw new Error("Profile not found");

      // Use atomic RPC function to prevent race conditions
      const { data, error } = await supabase.rpc('hire_player', {
        p_profile_id: profile.id,
        p_job_id: jobId
      });

      if (error) {
        if (error.message.includes('Position is no longer available')) {
          throw new Error('This position was just filled. Please try another job.');
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-employment"] });
      queryClient.invalidateQueries({ queryKey: ["available-jobs"] });
      toast({ title: "Job accepted!", description: "Auto-attend is enabled by default. You'll clock in automatically when shifts start." });
    },
    onError: (error: any) => {
      toast({ title: "Position Unavailable", description: error.message, variant: "destructive" });
    },
  });

  const quitJobMutation = useMutation({
    mutationFn: async () => {
      if (!currentEmployment) throw new Error("No current employment");

      // Use atomic RPC function to properly decrement employee count
      const { error } = await supabase.rpc('quit_job', {
        p_employment_id: currentEmployment.id
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-employment"] });
      queryClient.invalidateQueries({ queryKey: ["available-jobs"] });
      toast({ title: "You quit your job", description: "You can apply for a new job anytime." });
    },
    onError: (error: any) => {
      toast({ title: "Error quitting job", description: error.message, variant: "destructive" });
    },
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!currentEmployment || !profile) throw new Error("Missing data");
      
      const job = currentEmployment.jobs;
      if (!job) throw new Error("Job details not found");

      // Check if in correct city
      if (job.city_id && job.city_id !== profile.current_city_id) {
        throw new Error("You must be in the job's city to clock in");
      }

      const [startHour, startMin] = job.start_time.split(':').map(Number);
      const [endHour, endMin] = job.end_time.split(':').map(Number);
      const hours = (endHour + endMin / 60) - (startHour + startMin / 60);
      const earnings = Math.round(job.hourly_wage * hours);

      const { data: shift, error: shiftError } = await supabase
        .from("shift_history")
        .insert([{
          employment_id: currentEmployment.id,
          profile_id: profile.id,
          job_id: job.id,
          shift_date: new Date().toISOString().split('T')[0],
          clock_in_time: new Date().toISOString(),
          earnings: earnings,
          health_impact: job.health_impact_per_shift,
          fame_impact: job.fame_impact_per_shift,
          xp_earned: Math.round(earnings / 10),
          status: "in_progress"
        }])
        .select()
        .single();

      if (shiftError) throw shiftError;

      const now = new Date();
      const endTime = new Date(now);
      endTime.setHours(endHour, endMin, 0, 0);

      const { error: statusError } = await supabase
        .from("profile_activity_statuses")
        .insert([{
          profile_id: profile.id,
          activity_type: "work_shift",
          status: "active",
          started_at: now.toISOString(),
          ends_at: endTime.toISOString(),
          metadata: { job_id: job.id, shift_history_id: shift.id, earnings_pending: earnings }
        }]);

      if (statusError) throw statusError;

      // Apply health drain
      const newHealth = Math.max(0, (profile.health || 100) + (job.health_impact_per_shift || 0));
      const newEnergy = Math.max(0, (profile.energy || 100) - (job.energy_cost_per_shift || 0));
      await supabase.from("profiles").update({ health: newHealth, energy: newEnergy }).eq("id", profile.id);

      return shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-status"] });
      queryClient.invalidateQueries({ queryKey: ["shift-history"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Clocked in!", description: "Your shift has started. Good luck!" });
    },
    onError: (error: any) => {
      toast({ title: "Error clocking in", description: error.message, variant: "destructive" });
    },
  });

  const toggleAutoAttendMutation = useMutation({
    mutationFn: async () => {
      if (!currentEmployment) throw new Error("No current employment");

      const autoAttendEnabled = Boolean(currentEmployment.auto_clock_in);
      const { data, error } = await supabase
        .from("player_employment")
        .update({ auto_clock_in: !autoAttendEnabled })
        .eq("id", currentEmployment.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["current-employment"] });
      toast({
        title: data.auto_clock_in ? "Auto-attend enabled" : "Auto-attend disabled",
        description: data.auto_clock_in
          ? "You'll automatically clock in when shifts start (if in city and no conflicts)."
          : "Automatic clock-ins have been turned off.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error updating preference", description: error.message, variant: "destructive" });
    },
  });

  const canApply = (job: JobRow) => {
    if (!profile) return false;
    if (currentEmployment) return false;
    if (playerLevel < (job.required_level || 1)) return false;
    if (job.max_employees && (job.current_employees || 0) >= job.max_employees) return false;
    return true;
  };

  const getNextShiftTime = () => {
    if (!currentEmployment) return null;
    const job = currentEmployment.jobs;
    if (!job) return null;
    const workDays = Array.isArray(job.work_days) ? job.work_days : [];
    
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    if (workDays.includes(currentDay)) {
      const [startHour, startMin] = job.start_time.split(':').map(Number);
      const shiftStart = new Date(now);
      shiftStart.setHours(startHour, startMin, 0, 0);
      
      if (now < shiftStart) {
        return shiftStart;
      }
    }
    
    return null;
  };

  const canClockIn = () => {
    if (!currentEmployment || activityStatus) return false;
    if (!profile || (profile.health || 100) < 20 || (profile.energy || 100) < 10) return false;
    
    const job = currentEmployment.jobs;
    if (job?.city_id && job.city_id !== profile.current_city_id) return false;
    
    const nextShift = getNextShiftTime();
    if (!nextShift) return false;
    
    const now = new Date();
    const timeDiff = nextShift.getTime() - now.getTime();
    const minutesUntil = timeDiff / (1000 * 60);
    
    return minutesUntil <= 15 && minutesUntil >= 0;
  };

  const autoAttendEnabled = Boolean(currentEmployment?.auto_clock_in);
  const currentJob = currentEmployment?.jobs ?? null;

  return (
    <div className="min-h-screen bg-gradient-stage p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-oswald font-bold mb-2">Employment</h1>
          <p className="text-muted-foreground">Find jobs to earn money while pursuing your music career</p>
          {currentCityName && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Currently in: <span className="font-medium">{currentCityName}</span>
            </p>
          )}
        </div>

        {activityStatus && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              You're currently at work. Your shift ends at {format(parseISO(activityStatus.ends_at), 'h:mm a')}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Find Jobs</span>
            </TabsTrigger>
            <TabsTrigger value="current" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">My Job</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="jobs" className="space-y-4 mt-4">
            {/* Filters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="h-4 w-4" /> Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Select value={cityFilter} onValueChange={setCityFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select city" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current">
                          <span className="flex items-center gap-2">
                            <MapPin className="h-3 w-3" /> My City {currentCityName && `(${currentCityName})`}
                          </span>
                        </SelectItem>
                        <SelectItem value="all">All Cities</SelectItem>
                        {cities?.map((city) => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.name}, {city.country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Wage Range: ${wageRange[0]} - ${wageRange[1]}/hr</Label>
                    <Slider
                      value={wageRange}
                      onValueChange={setWageRange}
                      min={0}
                      max={100}
                      step={5}
                      className="mt-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search jobs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Job Results */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{filteredJobs.length} jobs found</p>
            </div>

            {filteredJobs.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No jobs found matching your filters.</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredJobs.map((job) => (
                  <Card key={job.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{job.title}</CardTitle>
                          <CardDescription className="text-xs">{job.company_name}</CardDescription>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {job.category?.replace("_", " ")}
                        </Badge>
                      </div>
                      {job.cities && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {job.cities.name}, {job.cities.country}
                          {job.city_id === currentCityId && (
                            <Badge variant="secondary" className="ml-1 text-[10px] px-1">Your City</Badge>
                          )}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1 space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-green-600" />
                          <span className="font-semibold">${job.hourly_wage}/hr</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{job.start_time?.slice(0,5)} - {job.end_time?.slice(0,5)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        <Badge variant={getHealthBadgeVariant(job.health_impact_per_shift || 0)} className="text-xs">
                          <Heart className="h-3 w-3 mr-1" />
                          {(job.health_impact_per_shift || 0) > 0 ? "+" : ""}{job.health_impact_per_shift || 0}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Zap className="h-3 w-3 mr-1" />
                          -{job.energy_cost_per_shift || 0}
                        </Badge>
                        {(job.fame_impact_per_shift || 0) > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            +{job.fame_impact_per_shift}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Level {job.required_level || 1} required</span>
                        {job.max_employees && (
                          <span>{job.current_employees || 0}/{job.max_employees} hired</span>
                        )}
                      </div>

                      <Button 
                        className="w-full" 
                        size="sm"
                        onClick={() => applyForJobMutation.mutate(job.id)}
                        disabled={!canApply(job) || applyForJobMutation.isPending}
                      >
                        {!profile ? "Login to apply" :
                         currentEmployment ? "Already employed" :
                         playerLevel < (job.required_level || 1) ? `Level ${job.required_level} required` :
                         job.max_employees && (job.current_employees || 0) >= job.max_employees ? "Position filled" :
                         "Apply for Job"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="current" className="space-y-4 mt-4">
            {currentEmployment && currentJob ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        {currentJob.title}
                      </CardTitle>
                      <CardDescription>{currentJob.company_name}</CardDescription>
                      {currentJob.cities && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {currentJob.cities.name}, {currentJob.cities.country}
                          {currentJob.city_id !== currentCityId && (
                            <Badge variant="destructive" className="ml-1 text-[10px]">Not in city!</Badge>
                          )}
                        </p>
                      )}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">Quit Job</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You will lose this job and will need to reapply if you want to work here again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => quitJobMutation.mutate()}>
                            Quit Job
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Hourly Wage</p>
                        <p className="font-semibold">${currentJob.hourly_wage}/hr</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Shifts Completed</p>
                        <p className="font-semibold">{currentEmployment.shifts_completed}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Earned</p>
                        <p className="font-semibold">${currentEmployment.total_earnings}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Work Days</p>
                        <p className="font-semibold capitalize">
                          {Array.isArray(currentJob.work_days)
                            ? (currentJob.work_days as string[]).map(d => d.slice(0,3)).join(", ")
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 text-sm flex-wrap">
                    <span className="flex items-center gap-1">
                      <Heart className={`h-4 w-4 ${getHealthColor(currentJob.health_impact_per_shift || 0)}`} />
                      Health: {(currentJob.health_impact_per_shift || 0) > 0 ? "+" : ""}{currentJob.health_impact_per_shift || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-primary" />
                      Fame: {(currentJob.fame_impact_per_shift || 0) > 0 ? "+" : ""}{currentJob.fame_impact_per_shift || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      Energy: -{currentJob.energy_cost_per_shift || 0}
                    </span>
                  </div>

                  {profile && (profile.health || 100) < 30 && (
                    <Alert variant="destructive">
                      <Heart className="h-4 w-4" />
                      <AlertDescription>
                        Your health is low ({profile.health}%). Working will drain your health further. Consider resting first!
                      </AlertDescription>
                    </Alert>
                  )}

                  {currentJob.city_id && currentJob.city_id !== currentCityId && (
                    <Alert variant="destructive">
                      <MapPin className="h-4 w-4" />
                      <AlertDescription>
                        You must travel to {currentJob.cities?.name} to work this job. You cannot clock in from your current location.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => clockInMutation.mutate()}
                      disabled={!canClockIn() || clockInMutation.isPending}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Clock In
                    </Button>
                    <Button
                      variant={autoAttendEnabled ? "secondary" : "outline"}
                      onClick={() => toggleAutoAttendMutation.mutate()}
                      disabled={toggleAutoAttendMutation.isPending}
                      className={autoAttendEnabled ? "bg-emerald-600 text-white hover:bg-emerald-700" : undefined}
                    >
                      <CalendarCheck className="mr-2 h-4 w-4" />
                      {autoAttendEnabled ? "Auto-Attend On" : "Auto-Attend Off"}
                    </Button>
                    {!canClockIn() && !activityStatus && (
                      <p className="text-sm text-muted-foreground">
                        {profile && (profile.health || 100) < 20 ? "Not enough health to work" :
                         profile && (profile.energy || 100) < 10 ? "Not enough energy to work" :
                         currentJob.city_id && currentJob.city_id !== currentCityId ? "Not in job city" :
                         "Wait for your shift to start"}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Current Job</h3>
                <p className="text-muted-foreground mb-4">Browse available jobs and apply to start earning money.</p>
                <Button onClick={() => setActiveTab("jobs")}>Find Jobs</Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            {shiftHistory && shiftHistory.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Work History</CardTitle>
                  <CardDescription>Your recent shifts and earnings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {shiftHistory.map((shift) => (
                      <div key={shift.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">{shift.jobs?.title ?? "Unknown job"}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(shift.shift_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">${shift.earnings}</p>
                          <Badge variant={shift.status === "completed" ? "default" : "secondary"} className="text-xs">
                            {shift.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Work History</h3>
                <p className="text-muted-foreground">Complete shifts to see your work history here.</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
