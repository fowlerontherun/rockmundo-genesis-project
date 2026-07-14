import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Briefcase, DollarSign, MapPin, Plus, Users, XCircle, CheckCircle2 } from "lucide-react";

const STAFF = ["manager", "assistant_manager", "customer_service", "sales", "marketing", "finance", "security", "technician", "cleaner", "specialist"];
const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "temporary"];

interface Props {
  companyId: string;
  companyName: string;
  headquartersCityId?: string | null;
}

export function CompanyRecruitmentLifecycle({ companyId, companyName, headquartersCityId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedVacancy, setSelectedVacancy] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [staffCategory, setStaffCategory] = useState("specialist");
  const [positions, setPositions] = useState(1);
  const [weeklyWage, setWeeklyWage] = useState(500);
  const [employmentType, setEmploymentType] = useState("full_time");
  const [closesAt, setClosesAt] = useState("");
  const [cityId, setCityId] = useState(headquartersCityId ?? "");

  const reset = () => {
    setTitle(""); setDescription(""); setStaffCategory("specialist"); setPositions(1); setWeeklyWage(500); setEmploymentType("full_time"); setClosesAt(""); setCityId(headquartersCityId ?? "");
  };

  const { data: cities = [] } = useQuery({
    queryKey: ["cities-for-company-recruitment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cities").select("id, name, country").order("country").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: vacancies = [], isLoading } = useQuery({
    queryKey: ["company-vacancies", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_vacancies")
        .select("*, cities:location_city_id(name, country), company_job_applications(id,status,suitability_score,created_at,applicant_profile_id,message, profiles:applicant_profile_id(display_name,avatar_url))")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["company-lifecycle-employees", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("company_employees") as any)
        .select("*, profiles:profile_id(display_name, avatar_url)")
        .eq("company_id", companyId)
        .order("status", { ascending: true })
        .order("hired_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveVacancy = useMutation({
    mutationFn: async (action: "save_draft" | "publish") => {
      const { error } = await (supabase as any).rpc("manage_company_vacancy", {
        p_company_id: companyId,
        p_action: action,
        p_job_title: title,
        p_staff_category: staffCategory,
        p_description: description || null,
        p_positions_available: positions,
        p_weekly_wage: weeklyWage,
        p_employment_type: employmentType,
        p_is_permanent: employmentType !== "contract" && employmentType !== "temporary",
        p_required_skills: {},
        p_preferred_skills: {},
        p_minimum_skill_levels: {},
        p_location_city_id: cityId || null,
        p_expected_activity_level: "regular",
        p_closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Vacancy saved" }); qc.invalidateQueries({ queryKey: ["company-vacancies", companyId] }); setOpen(false); reset(); },
    onError: (e: Error) => toast({ title: "Could not save vacancy", description: e.message, variant: "destructive" }),
  });

  const vacancyAction = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "close" | "cancel" | "reopen" }) => {
      const { error } = await (supabase as any).rpc("manage_company_vacancy", { p_vacancy_id: id, p_action: action });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-vacancies", companyId] }),
    onError: (e: Error) => toast({ title: "Vacancy action failed", description: e.message, variant: "destructive" }),
  });

  const review = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "offer" | "reject" }) => {
      const { error } = await (supabase as any).rpc("review_company_application", { p_application_id: id, p_action: action });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Application updated" }); qc.invalidateQueries({ queryKey: ["company-vacancies", companyId] }); },
    onError: (e: Error) => toast({ title: "Review failed", description: e.message, variant: "destructive" }),
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("dismiss_company_employee", { p_employee_id: id, p_reason: "Dismissed by company management" });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Employee dismissed" }); qc.invalidateQueries({ queryKey: ["company-lifecycle-employees", companyId] }); },
    onError: (e: Error) => toast({ title: "Dismissal failed", description: e.message, variant: "destructive" }),
  });

  const deleteVacancy = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_vacancies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Vacancy deleted" }); qc.invalidateQueries({ queryKey: ["company-vacancies", companyId] }); },
    onError: (e: Error) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const currentVacancy = useMemo(() => vacancies.find((v: any) => v.id === selectedVacancy), [selectedVacancy, vacancies]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" />Recruitment</CardTitle>
            <CardDescription>Create vacancies, review applications, make offers, and preserve hiring history for {companyName}.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Create vacancy</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading vacancies…</p> : vacancies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><Briefcase className="h-10 w-10 mx-auto mb-3 opacity-50" /><p>No vacancies yet.</p></div>
          ) : <div className="grid gap-3 md:grid-cols-2">
            {vacancies.map((v: any) => {
              const applications = v.company_job_applications ?? [];
              return <div key={v.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2"><div><p className="font-medium">{v.job_title}</p><p className="text-xs text-muted-foreground">{v.staff_category} • {v.cities?.name ?? "No city"}</p></div><Badge variant={v.status === "open" ? "default" : "secondary"}>{v.status}</Badge></div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${v.weekly_wage}/week</span><span className="flex items-center gap-1"><Users className="h-3 w-3" />{v.positions_filled}/{v.positions_available} filled</span><span>{applications.length} applications</span></div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedVacancy(v.id)}>View applicants</Button>
                  {v.status === "open" && <Button size="sm" variant="outline" onClick={() => vacancyAction.mutate({ id: v.id, action: "close" })}>Close</Button>}
                  {v.status === "closed" && <Button size="sm" variant="outline" onClick={() => vacancyAction.mutate({ id: v.id, action: "reopen" })}>Reopen</Button>}
                  {!["filled", "cancelled"].includes(v.status) && <Button size="sm" variant="destructive" onClick={() => vacancyAction.mutate({ id: v.id, action: "cancel" })}>Cancel</Button>}
                  {v.status === "cancelled" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="sm" variant="destructive">Delete</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete cancelled vacancy?</AlertDialogTitle><AlertDialogDescription>This permanently removes the vacancy and its application records. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteVacancy.mutate(v.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>;
            })}
          </div>}
        </CardContent>
      </Card>

      {currentVacancy && <Card>
        <CardHeader><CardTitle>Applicants for {currentVacancy.job_title}</CardTitle><CardDescription>Owners only see public profile details, suitability scores, and application messages.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {(currentVacancy.company_job_applications ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No applications yet.</p> : (currentVacancy.company_job_applications ?? []).map((app: any) => <div key={app.id} className="rounded-lg border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-medium">{app.profiles?.display_name ?? "Applicant"}</p><p className="text-sm text-muted-foreground">{app.message || "No message supplied."}</p><div className="flex gap-2 mt-1"><Badge variant="outline">{app.status}</Badge><Badge>Suitability {app.suitability_score}%</Badge></div></div>
            <div className="flex gap-2"><Button size="sm" onClick={() => review.mutate({ id: app.id, action: "offer" })} disabled={!['pending','application_submitted'].includes(app.status)}><CheckCircle2 className="h-4 w-4 mr-1" />Offer</Button><Button size="sm" variant="destructive" onClick={() => review.mutate({ id: app.id, action: "reject" })} disabled={!['pending','application_submitted','offer_made'].includes(app.status)}><XCircle className="h-4 w-4 mr-1" />Reject</Button></div>
          </div>)}
        </CardContent>
      </Card>}

      <Card>
        <CardHeader><CardTitle>Staff</CardTitle><CardDescription>NPC and real-player staff that feed the weekly company finance processor.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {employees.length === 0 ? <p className="text-sm text-muted-foreground">No staff records yet.</p> : employees.map((emp: any) => <div key={emp.id} className="rounded-lg border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-medium">{emp.profiles?.display_name ?? emp.job_title ?? emp.role}</p><p className="text-xs text-muted-foreground">{emp.employee_type} • {emp.staff_category} • ${emp.weekly_wage ?? emp.salary}/week • suitability {emp.suitability_rating ?? 0}%</p></div>
            <div className="flex gap-2 items-center"><Badge variant={emp.status === "active" ? "default" : "secondary"}>{emp.contract_status ?? emp.status}</Badge>{emp.employee_type === "player" && emp.status === "active" && <AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="destructive">Dismiss</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Dismiss employee?</AlertDialogTitle><AlertDialogDescription>This preserves employment history and stops future wages/performance contributions.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => dismiss.mutate(emp.id)}>Dismiss</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div>
          </div>)}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Create company vacancy</DialogTitle><DialogDescription>Use server-side validation to save a draft or publish to the player jobs marketplace.</DialogDescription></DialogHeader>
          <div className="space-y-4"><div><Label>Job title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div><div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Staff category</Label><Select value={staffCategory} onValueChange={setStaffCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STAFF.map((s) => <SelectItem key={s} value={s}>{s.split("_").join(" ")}</SelectItem>)}</SelectContent></Select></div><div><Label>Employment type</Label><Select value={employmentType} onValueChange={setEmploymentType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EMPLOYMENT_TYPES.map((s) => <SelectItem key={s} value={s}>{s.split("_").join(" ")}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="grid grid-cols-3 gap-3"><div><Label>Positions</Label><Input type="number" min={1} value={positions} onChange={(e) => setPositions(Number(e.target.value) || 1)} /></div><div><Label>Weekly wage</Label><Input type="number" min={0} value={weeklyWage} onChange={(e) => setWeeklyWage(Number(e.target.value) || 0)} /></div><div><Label>Closing date</Label><Input type="date" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></div></div>
            <div><Label>Location</Label><Select value={cityId} onValueChange={setCityId}><SelectTrigger><SelectValue placeholder="Choose city" /></SelectTrigger><SelectContent>{cities.map((c: any) => <SelectItem key={c.id} value={c.id}><MapPin className="h-3 w-3 mr-1 inline" />{c.name}, {c.country}</SelectItem>)}</SelectContent></Select></div>
          </div><DialogFooter><Button variant="outline" onClick={() => saveVacancy.mutate("save_draft")}>Save draft</Button><Button onClick={() => saveVacancy.mutate("publish")}>Publish</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
