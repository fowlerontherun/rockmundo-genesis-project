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
import { Briefcase, DollarSign, MapPin, Plus, Users, CheckCircle2, XCircle, ListChecks, History, BarChart3 } from "lucide-react";
import { getRolesForCompanyType } from "@/data/companyRoles";

const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "temporary"];
const db = supabase as any;

type Props = { companyId: string; companyName: string; companyType?: string | null; headquartersCityId?: string | null };

function parseSkillRequirements(value: string) {
  const result: Record<string, number> = {};
  for (const item of value.split(",")) {
    const [slug, level] = item.split(":").map((part) => part.trim());
    if (!slug) continue;
    const parsed = Number(level || 0);
    if (Number.isFinite(parsed) && parsed >= 0) result[slug] = Math.floor(parsed);
  }
  return result;
}

export function CompanyRecruitmentLifecycle({ companyId, companyName, companyType, headquartersCityId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedVacancy, setSelectedVacancy] = useState<string | null>(null);
  const [roleKey, setRoleKey] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [staffCategory, setStaffCategory] = useState("specialist");
  const [positions, setPositions] = useState(1);
  const [weeklyWage, setWeeklyWage] = useState(500);
  const [employmentType, setEmploymentType] = useState("full_time");
  const [closesAt, setClosesAt] = useState("");
  const [cityId, setCityId] = useState(headquartersCityId ?? "");
  const [skillRequirements, setSkillRequirements] = useState("");
  const [minimumReputation, setMinimumReputation] = useState(0);

  const roles = useMemo(() => getRolesForCompanyType(companyType), [companyType]);

  const { data: cities = [] } = useQuery({
    queryKey: ["cities-for-company-recruitment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cities").select("id,name,country").order("country").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: vacancies = [], isLoading } = useQuery({
    queryKey: ["company-vacancies", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_vacancies")
        .select("*,cities:location_city_id(name,country),company_job_applications(id,status,suitability_score,created_at,applicant_profile_id,message,offer_expires_at,profiles:applicant_profile_id(display_name,avatar_url))")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["company-recruitment-events", companyId],
    queryFn: async () => {
      const { data, error } = await db.from("company_recruitment_events").select("id,event_type,created_at,vacancy_id,application_id").eq("company_id", companyId).order("created_at", { ascending: false }).limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ["company-labor-market-analytics", companyId],
    queryFn: async () => {
      const { data, error } = await db.rpc("get_company_labor_market_analytics", { p_company_id: companyId });
      if (error) throw error;
      return data as { market?: any[]; recentHires?: any[] };
    },
  });

  const reset = () => {
    setRoleKey(""); setTitle(""); setDescription(""); setStaffCategory("specialist"); setPositions(1);
    setWeeklyWage(500); setEmploymentType("full_time"); setClosesAt(""); setCityId(headquartersCityId ?? "");
    setSkillRequirements(""); setMinimumReputation(0);
  };

  const saveVacancy = useMutation({
    mutationFn: async (action: "save_draft" | "publish") => {
      const minimumSkills = parseSkillRequirements(skillRequirements);
      const { data: vacancyId, error } = await db.rpc("manage_company_vacancy", {
        p_company_id: companyId, p_action: action, p_job_title: title, p_staff_category: staffCategory,
        p_description: description || null, p_positions_available: positions, p_weekly_wage: weeklyWage,
        p_employment_type: employmentType, p_is_permanent: !["contract", "temporary"].includes(employmentType),
        p_required_skills: minimumSkills, p_preferred_skills: {}, p_minimum_skill_levels: minimumSkills,
        p_location_city_id: cityId || null, p_expected_activity_level: "regular",
        p_closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      });
      if (error) throw error;
      const { error: requirementError } = await db.rpc("set_company_vacancy_requirements", {
        p_vacancy_id: vacancyId, p_location_city_id: cityId || null,
        p_minimum_skill_levels: minimumSkills, p_minimum_reputation_score: minimumReputation,
      });
      if (requirementError) throw requirementError;
    },
    onSuccess: () => {
      toast({ title: "Vacancy saved", description: "Requirements and audit history are server-authoritative." });
      qc.invalidateQueries({ queryKey: ["company-vacancies", companyId] });
      qc.invalidateQueries({ queryKey: ["company-recruitment-events", companyId] });
      qc.invalidateQueries({ queryKey: ["company-labor-market-analytics", companyId] });
      setOpen(false); reset();
    },
    onError: (error: Error) => toast({ title: "Could not save vacancy", description: error.message, variant: "destructive" }),
  });

  const vacancyAction = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "close" | "cancel" | "reopen" }) => {
      const { error } = await db.rpc("manage_company_vacancy", { p_vacancy_id: id, p_action: action });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-vacancies", companyId] });
      qc.invalidateQueries({ queryKey: ["company-recruitment-events", companyId] });
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "shortlist" | "offer" | "reject" }) => {
      const { error } = await db.rpc("review_company_application", { p_application_id: id, p_action: action });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Application updated" });
      qc.invalidateQueries({ queryKey: ["company-vacancies", companyId] });
      qc.invalidateQueries({ queryKey: ["company-recruitment-events", companyId] });
    },
    onError: (error: Error) => toast({ title: "Review failed", description: error.message, variant: "destructive" }),
  });

  const currentVacancy = (vacancies as any[]).find((vacancy) => vacancy.id === selectedVacancy);

  return <div className="space-y-4">
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div><CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" />Recruitment</CardTitle><CardDescription>Auditable vacancies, applications, shortlist and offers for {companyName}.</CardDescription></div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Post vacancy</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading vacancies…</p> : (vacancies as any[]).length === 0 ? <p className="text-sm text-muted-foreground">No vacancies yet.</p> : (vacancies as any[]).map((vacancy) => <div key={vacancy.id} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{vacancy.job_title}</p><p className="text-xs text-muted-foreground">{vacancy.cities?.name ?? "Any city"} · ${vacancy.weekly_wage}/week · reputation {vacancy.minimum_reputation_score ?? 0}+</p></div><Badge>{vacancy.status}</Badge></div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{vacancy.positions_filled}/{vacancy.positions_available} filled</span><span>{(vacancy.company_job_applications ?? []).length} applications</span></div>
          <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setSelectedVacancy(vacancy.id)}>Applicants</Button>{vacancy.status === "open" && <Button size="sm" variant="outline" onClick={() => vacancyAction.mutate({ id: vacancy.id, action: "close" })}>Close</Button>}{vacancy.status === "closed" && <Button size="sm" variant="outline" onClick={() => vacancyAction.mutate({ id: vacancy.id, action: "reopen" })}>Reopen</Button>}{!["filled", "cancelled"].includes(vacancy.status) && <Button size="sm" variant="destructive" onClick={() => vacancyAction.mutate({ id: vacancy.id, action: "cancel" })}>Cancel</Button>}</div>
        </div>)}
      </CardContent>
    </Card>

    {currentVacancy && <Card><CardHeader><CardTitle>Applicants for {currentVacancy.job_title}</CardTitle><CardDescription>Shortlist before offering, or reject with the transition retained in audit history.</CardDescription></CardHeader><CardContent className="space-y-3">{(currentVacancy.company_job_applications ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No applications yet.</p> : (currentVacancy.company_job_applications ?? []).map((app: any) => <div key={app.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{app.profiles?.display_name ?? "Applicant"}</p><p className="text-sm text-muted-foreground">{app.message || "No message supplied."}</p><div className="mt-1 flex gap-2"><Badge variant="outline">{app.status}</Badge><Badge>Suitability {app.suitability_score}%</Badge></div></div><div className="flex flex-wrap gap-2">{["pending", "application_submitted"].includes(app.status) && <Button size="sm" variant="outline" onClick={() => review.mutate({ id: app.id, action: "shortlist" })}><ListChecks className="mr-1 h-4 w-4" />Shortlist</Button>}{["pending", "application_submitted", "shortlisted"].includes(app.status) && <Button size="sm" onClick={() => review.mutate({ id: app.id, action: "offer" })}><CheckCircle2 className="mr-1 h-4 w-4" />Offer</Button>}{!["hired", "rejected", "declined", "withdrawn", "expired"].includes(app.status) && <Button size="sm" variant="destructive" onClick={() => review.mutate({ id: app.id, action: "reject" })}><XCircle className="mr-1 h-4 w-4" />Reject</Button>}</div></div>)}</CardContent></Card>}

    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Labour market reference</CardTitle><CardDescription>Read-only salary and demand analytics from real vacancy history.</CardDescription></CardHeader><CardContent className="space-y-2">{(analytics?.market ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No market history yet.</p> : (analytics?.market ?? []).slice(0,8).map((row: any) => <div key={`${row.jobTitle}-${row.staffCategory}`} className="flex items-center justify-between rounded border p-2 text-sm"><div><p className="font-medium">{row.jobTitle}</p><p className="text-xs text-muted-foreground">{row.applications ?? 0} applications · {row.openVacancies ?? 0} open</p></div><div className="text-right"><p>${row.averageWeeklyWage}/wk avg</p><p className="text-xs text-muted-foreground">${row.minimumWeeklyWage}–${row.maximumWeeklyWage}</p></div></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Recruitment history</CardTitle><CardDescription>Server-recorded evidence; cancelled vacancies are retained rather than deleted.</CardDescription></CardHeader><CardContent className="space-y-2">{events.length === 0 ? <p className="text-sm text-muted-foreground">No recruitment events yet.</p> : events.slice(0,12).map((event: any) => <div key={event.id} className="flex items-center justify-between rounded border p-2 text-sm"><span>{String(event.event_type).replaceAll("_", " ")}</span><span className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span></div>)}</CardContent></Card>
    </div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Create company vacancy</DialogTitle><DialogDescription>Applicants must satisfy the server-side location, skill and verified reputation requirements.</DialogDescription></DialogHeader><div className="space-y-4">
      <div><Label>Preset role</Label><Select value={roleKey} onValueChange={(value) => { setRoleKey(value); const role = roles.find((item) => item.key === value); if (role) { setTitle(role.title); setDescription(role.description); setStaffCategory(role.category); setWeeklyWage(role.weeklyWage); } }}><SelectTrigger><SelectValue placeholder="Optional preset" /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.key} value={role.key}>{role.title}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Job title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div><div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3"><div><Label>Positions</Label><Input type="number" min={1} value={positions} onChange={(e) => setPositions(Number(e.target.value))} /></div><div><Label>Weekly wage</Label><Input type="number" min={0} value={weeklyWage} onChange={(e) => setWeeklyWage(Number(e.target.value))} /></div></div>
      <div><Label>Employment type</Label><Select value={employmentType} onValueChange={setEmploymentType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EMPLOYMENT_TYPES.map((type) => <SelectItem key={type} value={type}>{type.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>City requirement</Label><Select value={cityId || "any"} onValueChange={(value) => setCityId(value === "any" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="any">Any city</SelectItem>{(cities as any[]).map((city) => <SelectItem key={city.id} value={city.id}>{city.name}, {city.country}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Minimum skills</Label><Input value={skillRequirements} onChange={(e) => setSkillRequirements(e.target.value)} placeholder="vocals:20, business:10" /><p className="mt-1 text-xs text-muted-foreground">Comma-separated skill slug and level.</p></div>
      <div><Label>Minimum verified reputation</Label><Input type="number" min={0} value={minimumReputation} onChange={(e) => setMinimumReputation(Number(e.target.value))} /></div>
      <div><Label>Closes at</Label><Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></div>
    </div><DialogFooter><Button variant="outline" onClick={() => saveVacancy.mutate("save_draft")} disabled={!title.trim() || saveVacancy.isPending}>Save draft</Button><Button onClick={() => saveVacancy.mutate("publish")} disabled={!title.trim() || saveVacancy.isPending}>Publish</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
