import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Briefcase, Plus, Trash2, MapPin, DollarSign, Power, PowerOff } from "lucide-react";

interface CompanyJobListingsProps {
  companyId: string;
  companyName: string;
  headquartersCityId: string | null | undefined;
}

const CATEGORIES = [
  { value: "food_service", label: "Food Service" },
  { value: "retail", label: "Retail" },
  { value: "music_industry", label: "Music Industry" },
  { value: "entertainment", label: "Entertainment" },
  { value: "hospitality", label: "Hospitality" },
  { value: "service", label: "Service" },
  { value: "manual_labor", label: "Manual Labor" },
];

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function CompanyJobListings({ companyId, companyName, headquartersCityId }: CompanyJobListingsProps) {
  const { userId } = useActiveProfile();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("service");
  const [hourlyWage, setHourlyWage] = useState(15);
  const [maxEmployees, setMaxEmployees] = useState(5);
  const [requiredLevel, setRequiredLevel] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [cityId, setCityId] = useState<string>(headquartersCityId ?? "");
  const [workDays, setWorkDays] = useState<string[]>(["monday", "tuesday", "wednesday", "thursday", "friday"]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("service");
    setHourlyWage(15);
    setMaxEmployees(5);
    setRequiredLevel(1);
    setStartTime("09:00");
    setEndTime("17:00");
    setCityId(headquartersCityId ?? "");
    setWorkDays(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  };

  const { data: cities } = useQuery({
    queryKey: ["cities-for-company-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, country")
        .order("country")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["company-jobs", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, cities:city_id(name, country)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createJob = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title is required");
      if (!cityId) throw new Error("Please choose a city");
      if (workDays.length === 0) throw new Error("Pick at least one work day");
      if (endTime <= startTime) throw new Error("End time must be after start time");

      const { error } = await supabase.from("jobs").insert({
        title: title.trim(),
        description: description.trim() || null,
        company_name: companyName,
        company_id: companyId,
        posted_by_user_id: userId,
        category,
        hourly_wage: hourlyWage,
        max_employees: maxEmployees,
        current_employees: 0,
        required_level: requiredLevel,
        start_time: startTime,
        end_time: endTime,
        city_id: cityId,
        work_days: workDays,
        is_active: true,
        health_impact_per_shift: -2,
        energy_cost_per_shift: 15,
        fame_impact_per_shift: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Job listed", description: "Players can now apply through the Employment page." });
      qc.invalidateQueries({ queryKey: ["company-jobs", companyId] });
      qc.invalidateQueries({ queryKey: ["available-jobs"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: Error) => {
      toast({ title: "Could not create listing", description: e.message, variant: "destructive" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("jobs").update({ is_active: !isActive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-jobs", companyId] });
      qc.invalidateQueries({ queryKey: ["available-jobs"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Job listing removed" });
      qc.invalidateQueries({ queryKey: ["company-jobs", companyId] });
      qc.invalidateQueries({ queryKey: ["available-jobs"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleDay = (day: string) => {
    setWorkDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Job Listings
          </CardTitle>
          <CardDescription>
            Post jobs at {companyName}. They appear in the Employment marketplace alongside system jobs.
          </CardDescription>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Listing
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading...</p>
        ) : jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No job listings yet.</p>
            <p className="text-sm mt-1">Create your first job to start hiring players.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job: any) => (
              <div key={job.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{job.title}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {job.category}
                    </Badge>
                    {!job.is_active && (
                      <Badge variant="secondary" className="text-[10px]">
                        Paused
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />${job.hourly_wage}/hr
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {job.cities?.name ?? "Unknown"}
                    </span>
                    <span>
                      {job.start_time}–{job.end_time}
                    </span>
                    <span>
                      {job.current_employees ?? 0}/{job.max_employees ?? "∞"} hired
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleActive.mutate({ id: job.id, isActive: job.is_active })}
                    disabled={toggleActive.isPending}
                    title={job.is_active ? "Pause listing" : "Activate listing"}
                  >
                    {job.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Delete job listing "${job.title}"?`)) deleteJob.mutate(job.id);
                    }}
                    disabled={deleteJob.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Job Listing</DialogTitle>
            <DialogDescription>
              Post a job at {companyName}. It will appear in the global Employment marketplace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Job Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Stage Hand" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will the worker do?"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>City</Label>
                <Select value={cityId} onValueChange={setCityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a city" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cities ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}, {c.country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Hourly Wage</Label>
                <Input
                  type="number"
                  min={1}
                  value={hourlyWage}
                  onChange={(e) => setHourlyWage(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Max Employees</Label>
                <Input
                  type="number"
                  min={1}
                  value={maxEmployees}
                  onChange={(e) => setMaxEmployees(Number(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label>Min Level</Label>
                <Input
                  type="number"
                  min={1}
                  value={requiredLevel}
                  onChange={(e) => setRequiredLevel(Number(e.target.value) || 1)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Time</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <Label>End Time</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Work Days</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {WEEKDAYS.map((day) => (
                  <label
                    key={day}
                    className={`text-xs px-2 py-1 rounded border cursor-pointer capitalize ${
                      workDays.includes(day)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={workDays.includes(day)}
                      onChange={() => toggleDay(day)}
                    />
                    {day.slice(0, 3)}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createJob.mutate()} disabled={createJob.isPending}>
              {createJob.isPending ? "Creating..." : "Create Listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
