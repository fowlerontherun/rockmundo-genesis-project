import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Plus, Trash2, Edit2, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const CATEGORIES = ["retail", "restaurant", "office", "manual_labor", "creative"];

export default function Jobs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    company_name: "",
    category: "retail",
    hourly_wage: 15,
    required_level: 1,
    health_impact_per_shift: 0,
    fame_impact_per_shift: 0,
    energy_cost_per_shift: 10,
    work_days: [] as string[],
    start_time: "09:00",
    end_time: "17:00",
    max_employees: null as number | null,
    is_active: true,
  });

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const createJobMutation = useMutation({
    mutationFn: async (jobData: typeof formData) => {
      const { data, error } = await supabase
        .from("jobs")
        .insert([jobData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast({ title: "Job created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error creating job", description: error.message, variant: "destructive" });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: async ({ id, ...jobData }: any) => {
      const { data, error } = await supabase
        .from("jobs")
        .update(jobData)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast({ title: "Job updated successfully" });
      setIsDialogOpen(false);
      setEditingJob(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error updating job", description: error.message, variant: "destructive" });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast({ title: "Job deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error deleting job", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveStatus = async (job: any) => {
    await updateJobMutation.mutateAsync({ id: job.id, is_active: !job.is_active });
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      company_name: "",
      category: "retail",
      hourly_wage: 15,
      required_level: 1,
      health_impact_per_shift: 0,
      fame_impact_per_shift: 0,
      energy_cost_per_shift: 10,
      work_days: [],
      start_time: "09:00",
      end_time: "17:00",
      max_employees: null,
      is_active: true,
    });
  };

  const handleEdit = (job: any) => {
    setEditingJob(job);
    setFormData({
      title: job.title,
      description: job.description || "",
      company_name: job.company_name,
      category: job.category,
      hourly_wage: job.hourly_wage,
      required_level: job.required_level,
      health_impact_per_shift: job.health_impact_per_shift,
      fame_impact_per_shift: job.fame_impact_per_shift,
      energy_cost_per_shift: job.energy_cost_per_shift,
      work_days: job.work_days || [],
      start_time: job.start_time,
      end_time: job.end_time,
      max_employees: job.max_employees,
      is_active: job.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingJob) {
      updateJobMutation.mutate({ id: editingJob.id, ...formData });
    } else {
      createJobMutation.mutate(formData);
    }
  };

  const toggleWorkDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter(d => d !== day)
        : [...prev.work_days, day]
    }));
  };

  const calculateHoursPerShift = () => {
    const [startHour, startMin] = formData.start_time.split(':').map(Number);
    const [endHour, endMin] = formData.end_time.split(':').map(Number);
    const hours = (endHour + endMin / 60) - (startHour + startMin / 60);
    return hours > 0 ? hours : 0;
  };

  const calculateSalaryPerShift = () => {
    return Math.round(formData.hourly_wage * calculateHoursPerShift());
  };

  return (
    <AdminRoute>
      <div className="min-h-screen bg-gradient-stage p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-oswald font-bold mb-2">Jobs Management</h1>
              <p className="text-muted-foreground">Create and manage employment opportunities for players</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setEditingJob(null); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Job
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingJob ? "Edit Job" : "Create New Job"}</DialogTitle>
                  <DialogDescription>
                    Configure job details, schedule, and impacts on player stats
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Job Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Company Name</Label>
                      <Input
                        id="company"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hourly_wage">Hourly Wage ($)</Label>
                      <Input
                        id="hourly_wage"
                        type="number"
                        value={formData.hourly_wage}
                        onChange={(e) => setFormData({ ...formData, hourly_wage: parseInt(e.target.value) })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="required_level">Required Level</Label>
                      <Input
                        id="required_level"
                        type="number"
                        value={formData.required_level}
                        onChange={(e) => setFormData({ ...formData, required_level: parseInt(e.target.value) })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="health_impact">Health Impact</Label>
                      <Input
                        id="health_impact"
                        type="number"
                        value={formData.health_impact_per_shift}
                        onChange={(e) => setFormData({ ...formData, health_impact_per_shift: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fame_impact">Fame Impact</Label>
                      <Input
                        id="fame_impact"
                        type="number"
                        value={formData.fame_impact_per_shift}
                        onChange={(e) => setFormData({ ...formData, fame_impact_per_shift: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="energy_cost">Energy Cost</Label>
                      <Input
                        id="energy_cost"
                        type="number"
                        value={formData.energy_cost_per_shift}
                        onChange={(e) => setFormData({ ...formData, energy_cost_per_shift: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Work Days</Label>
                    <div className="flex flex-wrap gap-3">
                      {DAYS_OF_WEEK.map(day => (
                        <div key={day} className="flex items-center space-x-2">
                          <Checkbox
                            id={day}
                            checked={formData.work_days.includes(day)}
                            onCheckedChange={() => toggleWorkDay(day)}
                          />
                          <Label htmlFor={day} className="capitalize cursor-pointer">{day}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_time">Start Time</Label>
                      <Input
                        id="start_time"
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_time">End Time</Label>
                      <Input
                        id="end_time"
                        type="time"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_employees">Max Employees</Label>
                      <Input
                        id="max_employees"
                        type="number"
                        value={formData.max_employees || ""}
                        onChange={(e) => setFormData({ ...formData, max_employees: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm"><strong>Hours per shift:</strong> {calculateHoursPerShift().toFixed(1)} hours</p>
                    <p className="text-sm"><strong>Salary per shift:</strong> ${calculateSalaryPerShift()}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <Label htmlFor="is_active">Active</Label>
                    </div>
                    <Button type="submit">
                      {editingJob ? "Update Job" : "Create Job"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading jobs...</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {jobs?.map((job) => (
                <Card key={job.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Briefcase className="h-5 w-5" />
                          {job.title}
                          {!job.is_active && <span className="text-xs bg-muted px-2 py-1 rounded">Inactive</span>}
                        </CardTitle>
                        <CardDescription>{job.company_name} • {job.category}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(job)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteJobMutation.mutate(job.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Hourly Wage</p>
                        <p className="font-semibold">${job.hourly_wage}/hr</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Schedule</p>
                        <p className="font-semibold">{job.start_time} - {job.end_time}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Work Days</p>
                        <p className="font-semibold">{Array.isArray(job.work_days) ? job.work_days.length : 0} days/week</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Employees</p>
                        <p className="font-semibold flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {job.current_employees}/{job.max_employees || "∞"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-4 text-sm">
                      <span className={job.health_impact_per_shift < 0 ? "text-destructive" : "text-green-600"}>
                        Health: {job.health_impact_per_shift > 0 ? "+" : ""}{job.health_impact_per_shift}
                      </span>
                      <span className="text-primary">
                        Fame: {job.fame_impact_per_shift > 0 ? "+" : ""}{job.fame_impact_per_shift}
                      </span>
                      <span className="text-muted-foreground">
                        Energy: -{job.energy_cost_per_shift}
                      </span>
                    </div>
                    <div className="mt-4">
                      <Button variant="outline" size="sm" onClick={() => toggleActiveStatus(job)}>
                        {job.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminRoute>
  );
}
