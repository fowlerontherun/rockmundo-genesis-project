import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Clock, DollarSign, Heart, Star, Zap, Calendar, TrendingUp, AlertCircle, CalendarCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Employment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAvailableJobs, setShowAvailableJobs] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: currentEmployment } = useQuery({
    queryKey: ["current-employment", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;

      const { data, error } = await supabase
        .from("player_employment")
        .select(`
          *,
          jobs (*)
        `)
        .eq("profile_id", profile.id)
        .eq("status", "employed")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: shiftHistory } = useQuery({
    queryKey: ["shift-history", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from("shift_history")
        .select(`
          *,
          jobs (title, company_name)
        `)
        .eq("profile_id", profile.id)
        .order("shift_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: availableJobs } = useQuery({
    queryKey: ["available-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("is_active", true)
        .order("hourly_wage", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const categories = useMemo(() => {
    if (!availableJobs) return [] as string[];
    return Array.from(
      new Set(
        availableJobs
          .map((job) => job.category)
          .filter((category): category is string => Boolean(category))
      )
    );
  }, [availableJobs]);

  const filteredJobs = useMemo(() => {
    if (!availableJobs) return [] as typeof availableJobs;
    if (categoryFilter === "all") return availableJobs;
    return availableJobs.filter((job) => job.category === categoryFilter);
  }, [availableJobs, categoryFilter]);

  const otherJobs = useMemo(() => {
    if (!currentEmployment) return [] as typeof filteredJobs;
    const currentJobId = (currentEmployment.jobs as any)?.id;
    return filteredJobs.filter((job) => job.id !== currentJobId);
  }, [filteredJobs, currentEmployment]);

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

  const applyForJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      if (!profile?.id) throw new Error("Profile not found");

      const { data, error } = await supabase
        .from("player_employment")
        .insert([{
          profile_id: profile.id,
          job_id: jobId,
          status: "employed"
        }])
        .select()
        .single();

      if (error) throw error;

      // Increment current_employees
      const job = availableJobs?.find(j => j.id === jobId);
      if (job) {
        await supabase
          .from("jobs")
          .update({ current_employees: (job.current_employees || 0) + 1 })
          .eq("id", jobId);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-employment"] });
      queryClient.invalidateQueries({ queryKey: ["available-jobs"] });
      toast({ title: "Successfully applied for job!", description: "You can now clock in during work hours." });
    },
    onError: (error: any) => {
      toast({ title: "Error applying for job", description: error.message, variant: "destructive" });
    },
  });

  const quitJobMutation = useMutation({
    mutationFn: async () => {
      if (!currentEmployment) throw new Error("No current employment");

      const { error } = await supabase
        .from("player_employment")
        .update({ status: "quit", terminated_at: new Date().toISOString() })
        .eq("id", currentEmployment.id);

      if (error) throw error;

      // Decrement current_employees
      const job = currentEmployment.jobs as any;
      if (job) {
        await supabase
          .from("jobs")
          .update({ current_employees: Math.max(0, (job.current_employees || 1) - 1) })
          .eq("id", job.id);
      }
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
      
      const job = currentEmployment.jobs as any;
      const [startHour, startMin] = job.start_time.split(':').map(Number);
      const [endHour, endMin] = job.end_time.split(':').map(Number);
      const hours = (endHour + endMin / 60) - (startHour + startMin / 60);
      const earnings = Math.round(job.hourly_wage * hours);

      // Create shift history
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

      // Create activity status
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
          metadata: {
            job_id: job.id,
            shift_history_id: shift.id,
            earnings_pending: earnings
          }
        }]);

      if (statusError) throw statusError;

      return shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-status"] });
      queryClient.invalidateQueries({ queryKey: ["shift-history"] });
      toast({ title: "Clocked in!", description: "Your shift has started. Good luck!" });
    },
    onError: (error: any) => {
      toast({ title: "Error clocking in", description: error.message, variant: "destructive" });
    },
  });

  const toggleAutoAttendMutation = useMutation({
    mutationFn: async () => {
      if (!currentEmployment) throw new Error("No current employment");

      const autoAttendEnabled = Boolean((currentEmployment as any)?.auto_clock_in);
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
        title: data.auto_clock_in ? "Always attend enabled" : "Always attend disabled",
        description: data.auto_clock_in
          ? "We'll automatically clock you in when your shifts start."
          : "Automatic clock-ins have been turned off.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating preference",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canApply = (job: any) => {
    if (!profile) return false;
    if (currentEmployment) return false;
    if (profile.level < job.required_level) return false;
    if (job.max_employees && job.current_employees >= job.max_employees) return false;
    return true;
  };

  const getNextShiftTime = () => {
    if (!currentEmployment) return null;
    const job = currentEmployment.jobs as any;
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
    if (!profile || profile.health < 20 || profile.energy < 10) return false;
    
    const nextShift = getNextShiftTime();
    if (!nextShift) return false;
    
    const now = new Date();
    const timeDiff = nextShift.getTime() - now.getTime();
    const minutesUntil = timeDiff / (1000 * 60);
    
    return minutesUntil <= 15 && minutesUntil >= 0;
  };

  const autoAttendEnabled = Boolean((currentEmployment as any)?.auto_clock_in);

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-oswald font-bold mb-2">Employment</h1>
          <p className="text-muted-foreground">Find jobs to earn money and build your career</p>
        </div>

        {activityStatus && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              You're currently at work. Your shift ends at {format(parseISO(activityStatus.ends_at), 'h:mm a')}
            </AlertDescription>
          </Alert>
        )}

        {availableJobs && availableJobs.length > 0 && (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span>
                    {categoryFilter === "all"
                      ? "All Categories"
                      : `Category: ${categoryFilter}`}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filter by category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={categoryFilter} onValueChange={setCategoryFilter}>
                  <DropdownMenuRadioItem value="all">All Categories</DropdownMenuRadioItem>
                  {categories.map((category) => (
                    <DropdownMenuRadioItem key={category} value={category}>
                      {category}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {currentEmployment && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    {(currentEmployment.jobs as any)?.title}
                  </CardTitle>
                  <CardDescription>{(currentEmployment.jobs as any)?.company_name}</CardDescription>
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
                    <p className="font-semibold">${(currentEmployment.jobs as any)?.hourly_wage}/hr</p>
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
                      {Array.isArray((currentEmployment.jobs as any)?.work_days) 
                        ? (currentEmployment.jobs as any).work_days.slice(0, 3).join(", ")
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Heart className={`h-4 w-4 ${(currentEmployment.jobs as any)?.health_impact_per_shift < 0 ? 'text-destructive' : 'text-green-600'}`} />
                  Health: {(currentEmployment.jobs as any)?.health_impact_per_shift > 0 ? "+" : ""}{(currentEmployment.jobs as any)?.health_impact_per_shift}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-primary" />
                  Fame: {(currentEmployment.jobs as any)?.fame_impact_per_shift > 0 ? "+" : ""}{(currentEmployment.jobs as any)?.fame_impact_per_shift}
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  Energy: -{(currentEmployment.jobs as any)?.energy_cost_per_shift}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => clockInMutation.mutate()}
                  disabled={!canClockIn()}
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
                  {autoAttendEnabled ? "Always Attend On" : "Always Attend Work"}
                </Button>
                {!canClockIn() && !activityStatus && (
                  <p className="text-sm text-muted-foreground">
                    {profile && profile.health < 20 ? "Not enough health to work" :
                     profile && profile.energy < 10 ? "Not enough energy to work" :
                     "Wait for your shift to start"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {!currentEmployment && availableJobs && filteredJobs.length === 0 && (
          <div className="rounded-lg border border-dashed border-muted-foreground/40 p-6 text-center text-sm text-muted-foreground">
            No jobs found for this category.
          </div>
        )}

        {!currentEmployment && filteredJobs.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map((job) => (
              <Card key={job.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{job.title}</CardTitle>
                  <CardDescription>{job.company_name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm line-clamp-2">{job.description}</p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hourly Wage:</span>
                      <span className="font-semibold">${job.hourly_wage}/hr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Schedule:</span>
                      <span>{job.start_time} - {job.end_time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Required Level:</span>
                      <span className={profile && profile.level >= job.required_level ? "text-green-600" : "text-destructive"}>
                        Level {job.required_level}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{job.category}</Badge>
                    {job.max_employees && (
                      <Badge variant="outline">
                        {job.current_employees}/{job.max_employees} hired
                      </Badge>
                    )}
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={() => applyForJobMutation.mutate(job.id)}
                    disabled={!canApply(job)}
                  >
                    {!profile ? "Login to apply" :
                     currentEmployment ? "Already employed" :
                     profile.level < job.required_level ? "Level too low" :
                     job.max_employees && job.current_employees >= job.max_employees ? "Position filled" :
                     "Apply for Job"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {currentEmployment && (
          <Collapsible open={showAvailableJobs} onOpenChange={setShowAvailableJobs}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full">
                {showAvailableJobs ? "Hide" : "Browse"} Other Jobs
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              {availableJobs && otherJobs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-muted-foreground/40 p-6 text-center text-sm text-muted-foreground">
                  No other jobs found for this category.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {otherJobs.map((job) => (
                    <Card key={job.id} className="opacity-60">
                      <CardHeader>
                        <CardTitle className="text-lg">{job.title}</CardTitle>
                        <CardDescription>{job.company_name}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">Quit your current job to apply here</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {shiftHistory && shiftHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Shifts</CardTitle>
              <CardDescription>Your work history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {shiftHistory.map((shift) => (
                  <div key={shift.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{(shift.jobs as any)?.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(shift.shift_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">${shift.earnings}</p>
                      <p className="text-xs text-muted-foreground">{shift.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
