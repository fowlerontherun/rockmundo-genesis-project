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
import { Briefcase, DollarSign, MapPin, Plus, Users, XCircle, CheckCircle2, Megaphone, Sparkles } from "lucide-react";
import { getRolesForCompanyType, type CompanyRole } from "@/data/companyRoles";

const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "temporary"];

interface Props {
  companyId: string;
  companyName: string;
  companyType?: string | null;
  headquartersCityId?: string | null;
}

export function CompanyRecruitmentLifecycle({ companyId, companyName, companyType, headquartersCityId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedVacancy, setSelectedVacancy] = useState<string | null>(null);
  const [roleKey, setRoleKey] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [staffCategory, setStaffCategory] = useState("specialist");
  const [positions, setPositions] = useState(1);
  const [weeklyWage, setWeeklyWage] = useState(500);
  const [employmentType, setEmploymentType] = useState("full_time");
  const [closesAt, setClosesAt] = useState("");
  const [cityId, setCityId] = useState(headquartersCityId ?? "");

  // Advertise dialog state
  const [adOpen, setAdOpen] = useState(false);
  const [adVacancyId, setAdVacancyId] = useState<string | null>(null);
  const [adDays, setAdDays] = useState(7);
  const [adDailySpend, setAdDailySpend] = useState(100);

  const roles = useMemo(() => getRolesForCompanyType(companyType), [companyType]);

  const applyRole = (key: string) => {
    setRoleKey(key);
    const r = roles.find((role) => role.key === key);
    if (r) {
      setTitle(r.title);
      setDescription(r.description);
      setStaffCategory(r.category);
      setWeeklyWage(r.weeklyWage);
    }
  };

  const reset = () => {
    setRoleKey(""); setTitle(""); setDescription(""); setStaffCategory("specialist"); setPositions(1); setWeeklyWage(500); setEmploymentType("full_time"); setClosesAt(""); setCityId(headquartersCityId ?? "");
  };

  const openWithRole = (role: CompanyRole) => {
    applyRole(role.key);
    setEmploymentType("full_time");
    setPositions(1);
    setClosesAt("");
    setCityId(headquartersCityId ?? "");
    setOpen(true);
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

  const roleFillStatus = useMemo(() => {
    const map = new Map<string, { open: number; filled: number }>();
    for (const r of roles) map.set(r.title, { open: 0, filled: 0 });
    for (const v of vacancies as any[]) {
      const entry = map.get(v.job_title);
      if (!entry) continue;
      if (v.status === "open") entry.open += Math.max(0, (v.positions_available ?? 0) - (v.positions_filled ?? 0));
      entry.filled += v.positions_filled ?? 0;
    }
    for (const e of employees as any[]) {
      const entry = map.get(e.job_title ?? "");
      if (entry && e.status === "active") entry.filled += 1;
    }
    return map;
  }, [roles, vacancies, employees]);

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

  const advertise = useMutation({
    mutationFn: async () => {
      if (!adVacancyId) throw new Error("No vacancy selected");
      const { error } = await (supabase as any).rpc("advertise_company_vacancy", {
        p_vacancy_id: adVacancyId,
        p_days: adDays,
        p_daily_spend: adDailySpend,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Vacancy advertised", description: `Boosted for ${adDays} day${adDays === 1 ? "" : "s"}.` });
      qc.invalidateQueries({ queryKey: ["company-vacancies", companyId] });
      qc.invalidateQueries({ queryKey: ["company-marketplace-vacancies"] });
      setAdOpen(false);
    },
    onError: (e: Error) => toast({ title: "Advertising failed", description: e.message, variant: "destructive" }),
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

  const currentVacancy = useMemo(() => (vacancies as any[]).find((v: any) => v.id === selectedVacancy), [selectedVacancy, vacancies]);

  const now = Date.now();

  return (
    <div className="space-y-4">
      {/* Role catalog */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Job roles for this company</CardTitle>
          <CardDescription>
            Every role a {companyType ? companyType.split("_").join(" ") : "company"} typically hires. Click a role to open a pre-filled vacancy form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => {
              const status = roleFillStatus.get(r.title) ?? { open: 0, filled: 0 };
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => openWithRole(r)}
                  className="text-left rounded-lg border p-3 hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.title}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{r.category.split("_").join(" ")}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                      ${r.weeklyWage}/wk
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                  <div className="mt-2 flex items-center gap-2 text-[10px]">
                    {status.filled > 0 && <Badge variant="secondary" className="text-[10px]">{status.filled} hired</Badge>}
                    {status.open > 0 && <Badge className="text-[10px]">{status.open} open</Badge>}
                    <span className="ml-auto text-primary flex items-center gap-1"><Plus className="h-3 w-3" />Post vacancy</span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" />Recruitment</CardTitle>
            <CardDescription>Create vacancies, advertise for applicants, review submissions and preserve hiring history for {companyName}.</CardDescription>
          </div>
          <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />Custom vacancy</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading vacancies…</p> : (vacancies as any[]).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><Briefcase className="h-10 w-10 mx-auto mb-3 opacity-50" /><p>No vacancies yet. Post one from the role catalog above.</p></div>
          ) : <div className="grid gap-3 md:grid-cols-2">
            {(vacancies as any[]).map((v: any) => {
              const applications = v.company_job_applications ?? [];
              const isAdvertised = v.advertised_until && new Date(v.advertised_until).getTime() > now;
              const daysLeft = isAdvertised ? Math.max(0, Math.ceil((new Date(v.advertised_until).getTime() - now) / 86400000)) : 0;
              return <div key={v.id} className={`rounded-lg border p-3 space-y-2 ${isAdvertised ? "border-primary/50 bg-primary/5" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{v.job_title}</p>
                      {isAdvertised && <Badge className="text-[10px] gap-1"><Megaphone className="h-3 w-3" />Featured · {daysLeft}d</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{v.staff_category} • {v.cities?.name ?? "No city"}</p>
                  </div>
                  <Badge variant={v.status === "open" ? "default" : "secondary"}>{v.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${v.weekly_wage}/week</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{v.positions_filled}/{v.positions_available} filled</span>
                  <span>{applications.length} applications</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedVacancy(v.id)}>View applicants</Button>
                  {["open","draft"].includes(v.status) && (
                    <Button size="sm" variant={isAdvertised ? "outline" : "default"} onClick={() => { setAdVacancyId(v.id); setAdDays(7); setAdDailySpend(100); setAdOpen(true); }}>
                      <Megaphone className="h-4 w-4 mr-1" />{isAdvertised ? "Boost more" : "Advertise"}
                    </Button>
                  )}
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
          {(employees as any[]).length === 0 ? <p className="text-sm text-muted-foreground">No staff records yet.</p> : (employees as any[]).map((emp: any) => <div key={emp.id} className="rounded-lg border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-medium">{emp.profiles?.display_name ?? emp.job_title ?? emp.role}</p><p className="text-xs text-muted-foreground">{emp.employee_type} • {emp.staff_category} • ${emp.weekly_wage ?? emp.salary}/week • suitability {emp.suitability_rating ?? 0}%</p></div>
            <div className="flex gap-2 items-center"><Badge variant={emp.status === "active" ? "default" : "secondary"}>{emp.contract_status ?? emp.status}</Badge>{emp.employee_type === "player" && emp.status === "active" && <AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="destructive">Dismiss</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Dismiss employee?</AlertDialogTitle><AlertDialogDescription>This preserves employment history and stops future wages/performance contributions.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => dismiss.mutate(emp.id)}>Dismiss</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div>
          </div>)}
        </CardContent>
      </Card>

      {/* Create vacancy dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create company vacancy</DialogTitle>
            <DialogDescription>Choose a preset role or fill in a custom listing. Draft is private; publishing sends it to the jobs marketplace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pre-set role (optional)</Label>
              <Select value={roleKey} onValueChange={applyRole}>
                <SelectTrigger><SelectValue placeholder="Choose a preset role for this company" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {roles.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.title} · ${r.weeklyWage}/wk
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Job title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Staff category</Label>
                <Input value={staffCategory} onChange={(e) => setStaffCategory(e.target.value)} />
              </div>
              <div>
                <Label>Employment type</Label>
                <Select value={employmentType} onValueChange={setEmploymentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPLOYMENT_TYPES.map((s) => <SelectItem key={s} value={s}>{s.split("_").join(" ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Positions</Label><Input type="number" min={1} value={positions} onChange={(e) => setPositions(Number(e.target.value) || 1)} /></div>
              <div><Label>Weekly wage</Label><Input type="number" min={0} value={weeklyWage} onChange={(e) => setWeeklyWage(Number(e.target.value) || 0)} /></div>
              <div><Label>Closing date</Label><Input type="date" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></div>
            </div>
            <div>
              <Label>Location</Label>
              <Select value={cityId} onValueChange={setCityId}>
                <SelectTrigger><SelectValue placeholder="Choose city" /></SelectTrigger>
                <SelectContent>{(cities as any[]).map((c: any) => <SelectItem key={c.id} value={c.id}><MapPin className="h-3 w-3 mr-1 inline" />{c.name}, {c.country}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => saveVacancy.mutate("save_draft")}>Save draft</Button>
            <Button onClick={() => saveVacancy.mutate("publish")}>Publish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advertise dialog */}
      <Dialog open={adOpen} onOpenChange={setAdOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" />Advertise vacancy</DialogTitle>
            <DialogDescription>Feature this listing at the top of the jobs marketplace to attract more applicants. Cost is billed from the company balance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duration (days)</Label>
                <Input type="number" min={1} max={60} value={adDays} onChange={(e) => setAdDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} />
              </div>
              <div>
                <Label>Daily spend ($)</Label>
                <Input type="number" min={10} step={10} value={adDailySpend} onChange={(e) => setAdDailySpend(Math.max(10, Number(e.target.value) || 10))} />
              </div>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total advertising spend</span>
                <span className="font-semibold">${(adDays * adDailySpend).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Higher daily spend = higher placement priority. Featured vacancies show a badge and appear first in player job searches.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdOpen(false)}>Cancel</Button>
            <Button onClick={() => advertise.mutate()} disabled={advertise.isPending}>
              <Megaphone className="h-4 w-4 mr-1" />
              {advertise.isPending ? "Charging…" : `Advertise for $${(adDays * adDailySpend).toLocaleString()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
