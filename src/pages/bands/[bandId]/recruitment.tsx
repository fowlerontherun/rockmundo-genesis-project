import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BAND_PERFORMANCE_ROLES, DEFAULT_BAND_PERFORMANCE_ROLE } from "@/data/bandPerformanceRoles";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import {
  createBandVacancy,
  deleteBandVacancy,
  listBandVacancies,
  updateBandVacancyStatus,
  type ApplicationQuestion,
  type BandVacancy,
  type VacancyFormInput,
} from "@/features/band-recruitment/services/recruitment";
import { toast } from "sonner";

const emptyForm = (): VacancyFormInput => ({
  title: "",
  description: "",
  instrument: DEFAULT_BAND_PERFORMANCE_ROLE,
  commitment_level: "flexible",
  positions_available: 1,
  visibility: "public",
  direct_applications_allowed: true,
  remote_or_travel_allowed: true,
  application_questions: [],
});

export default function BandRecruitmentManagement() {
  const { bandId } = useParams();
  const { profileId } = useActiveProfile();
  const roles = BAND_PERFORMANCE_ROLES;
  const [vacancies, setVacancies] = useState<BandVacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<VacancyFormInput>(emptyForm);
  const [questionsText, setQuestionsText] = useState("");
  const [dirty, setDirty] = useState(false);
  const set = (patch: VacancyFormInput) => { setForm((current) => ({ ...current, ...patch })); setDirty(true); };

  const parsedQuestions = useMemo<ApplicationQuestion[]>(() => questionsText
    .split("\n")
    .map((prompt) => prompt.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((prompt) => ({ type: "text", prompt, required: true })), [questionsText]);

  const refresh = async () => {
    if (!bandId) return;
    setLoading(true);
    try {
      const rows = await listBandVacancies(bandId);
      setVacancies(rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load advertised roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [bandId]);

  const save = async (publish: boolean) => {
    if (!bandId || !profileId) {
      toast.error("Select an active band-management character before advertising a role.");
      return;
    }
    if (questionsText.split("\n").filter((line) => line.trim()).length > 8) {
      toast.error("Use 8 application questions or fewer.");
      return;
    }
    setSaving(true);
    try {
      await createBandVacancy(bandId, profileId, { ...form, application_questions: parsedQuestions }, publish);
      toast.success(publish ? "Band role advertised" : "Vacancy draft saved");
      setForm(emptyForm());
      setQuestionsText("");
      setDirty(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save vacancy");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (vacancyId: string, status: "open" | "paused" | "closed" | "cancelled") => {
    setBusyId(vacancyId);
    try {
      await updateBandVacancyStatus(vacancyId, status);
      toast.success(status === "open" ? "Advert is live" : status === "paused" ? "Advert paused" : status === "closed" ? "Advert taken down" : "Advert cancelled");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update advert");
    } finally {
      setBusyId(null);
    }
  };

  const removeAdvert = async (vacancy: BandVacancy) => {
    if (!window.confirm(`Delete “${vacancy.title}”? Draft/closed adverts with application history are kept for audit purposes.`)) return;
    setBusyId(vacancy.id);
    try {
      await deleteBandVacancy(vacancy.id);
      toast.success("Advert deleted");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete advert");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="container mx-auto max-w-5xl p-4 sm:p-6" aria-labelledby="recruitment-title">
      <p className="text-sm text-muted-foreground">Band management</p>
      <h1 id="recruitment-title" className="text-3xl font-bold">Recruit band members</h1>
      <p className="mt-2 text-muted-foreground">Advertise the exact role your band needs. Leaders, co-leaders, managers and recruiters with recruitment permission can manage adverts. {dirty && <span role="status">Unsaved changes</span>}</p>

      <section className="mt-6 rounded-xl border bg-card p-4" aria-labelledby="new-vacancy-title">
        <h2 id="new-vacancy-title" className="text-xl font-semibold">Advertise a role</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-2"><span>Advert title</span><Input value={form.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="Lead guitarist wanted" maxLength={120} /></label>
          <label className="space-y-2"><span>Band role</span><Select value={form.instrument} onValueChange={(value) => set({ instrument: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent></Select></label>
          <label className="space-y-2"><span>Commitment level</span><Select value={form.commitment_level} onValueChange={(value) => set({ commitment_level: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["casual", "flexible", "regular", "serious", "professional"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></label>
          <label className="space-y-2"><span>Positions available</span><Input type="number" min={1} max={20} value={form.positions_available ?? 1} onChange={(e) => set({ positions_available: Number(e.target.value) })} /></label>
          <label className="space-y-2 sm:col-span-2"><span>Short summary</span><Input value={form.short_description ?? ""} onChange={(e) => set({ short_description: e.target.value })} placeholder="What kind of musician are you looking for?" maxLength={240} /></label>
          <label className="space-y-2 sm:col-span-2"><span>Full advert</span><Textarea value={form.description ?? ""} onChange={(e) => set({ description: e.target.value })} placeholder="Describe the band, expectations, rehearsals, gigs and what you want from the new member." rows={6} maxLength={4000} /></label>
          <label className="space-y-2 sm:col-span-2">
            <span>Application questions <span className="text-muted-foreground">(optional, one per line, max 8)</span></span>
            <Textarea value={questionsText} onChange={(e) => { setQuestionsText(e.target.value); setDirty(true); }} placeholder={"What experience do you have playing live?\nHow often can you rehearse?"} rows={4} />
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.audition_required ?? false} onChange={(e) => set({ audition_required: e.target.checked })} /> Audition required</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.remote_or_travel_allowed ?? true} onChange={(e) => set({ remote_or_travel_allowed: e.target.checked })} /> Travel / remote allowed</label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" disabled={saving} onClick={() => save(false)}>Save draft</Button>
          <Button disabled={saving} onClick={() => save(true)}>{saving ? "Publishing…" : "Publish advert"}</Button>
          <Button asChild variant="ghost"><Link to="/social/recruitment">View public adverts</Link></Button>
          <Button asChild variant="ghost"><Link to="/band/members">Review applications</Link></Button>
        </div>
      </section>

      <section className="mt-6" aria-labelledby="advertised-roles-title">
        <h2 id="advertised-roles-title" className="text-xl font-semibold">Your adverts</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pause temporarily, take an advert down by closing it, or reopen it later if positions remain.</p>
        {loading ? <p className="mt-3 text-muted-foreground">Loading adverts…</p> : vacancies.length === 0 ? (
          <div className="mt-3 rounded-xl border p-6 text-center text-muted-foreground">You have not advertised any band roles yet.</div>
        ) : (
          <div className="mt-3 space-y-3">
            {vacancies.map((vacancy) => {
              const remaining = Math.max(0, vacancy.positions_available - vacancy.positions_filled);
              const canReopen = !["open", "filled"].includes(vacancy.status) && remaining > 0;
              const canDelete = ["draft", "closed", "cancelled"].includes(vacancy.status);
              return (
                <div key={vacancy.id} className="rounded-xl border bg-card p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{vacancy.title}</h3><Badge variant={vacancy.status === "open" ? "default" : "secondary"}>{vacancy.status}</Badge></div>
                    <p className="mt-1 text-sm text-muted-foreground">{vacancy.instrument} • {vacancy.commitment_level} • {remaining} of {vacancy.positions_available} remaining</p>
                    {vacancy.short_description && <p className="mt-2 text-sm">{vacancy.short_description}</p>}
                    {(vacancy.application_questions?.length ?? 0) > 0 && <p className="mt-1 text-xs text-muted-foreground">{vacancy.application_questions?.length} application question(s)</p>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
                    {canReopen && <Button size="sm" disabled={busyId === vacancy.id} onClick={() => changeStatus(vacancy.id, "open")}>{vacancy.status === "draft" ? "Publish" : "Reopen"}</Button>}
                    {vacancy.status === "open" && <Button size="sm" variant="outline" disabled={busyId === vacancy.id} onClick={() => changeStatus(vacancy.id, "paused")}>Pause</Button>}
                    {!["closed", "filled", "cancelled"].includes(vacancy.status) && <Button size="sm" variant="outline" disabled={busyId === vacancy.id} onClick={() => changeStatus(vacancy.id, "closed")}>Take down</Button>}
                    {canDelete && <Button size="sm" variant="destructive" disabled={busyId === vacancy.id} onClick={() => removeAdvert(vacancy)}>Delete</Button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
