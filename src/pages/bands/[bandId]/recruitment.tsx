import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createBandVacancy, type VacancyFormInput } from "@/features/band-recruitment/services/recruitment";
import { toast } from "sonner";

export default function BandRecruitmentManagement() {
  const { bandId } = useParams();
  const [form, setForm] = useState<VacancyFormInput>({ title: "", description: "", instrument: "Guitar", commitment_level: "flexible", positions_available: 1, visibility: "public", direct_applications_allowed: true });
  const [dirty, setDirty] = useState(false);
  const set = (patch: VacancyFormInput) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };
  const save = async (publish: boolean) => {
    if (!bandId) return;
    try { await createBandVacancy(bandId, form, publish); toast.success(publish ? "Vacancy published" : "Draft saved"); setDirty(false); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not save vacancy"); }
  };
  return (
    <main className="container mx-auto max-w-5xl p-4 sm:p-6" aria-labelledby="recruitment-title">
      <p className="text-sm text-muted-foreground">Band management</p>
      <h1 id="recruitment-title" className="text-3xl font-bold">Recruitment</h1>
      <p className="mt-2 text-muted-foreground">Create vacancies, review applicants, send offers and preserve recruitment history. {dirty && <span role="status">Unsaved changes</span>}</p>
      <section className="mt-6 rounded-xl border bg-card p-4" aria-labelledby="new-vacancy-title">
        <h2 id="new-vacancy-title" className="text-xl font-semibold">New vacancy</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-2"><span>Position title</span><Input value={form.title ?? ""} onChange={(e)=>set({ title: e.target.value })} placeholder="Lead drummer" /></label>
          <label className="space-y-2"><span>Primary instrument</span><Select value={form.instrument} onValueChange={(v)=>set({ instrument: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Guitar","Bass","Drums","Keyboard","Other"].map((x)=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></label>
          <label className="space-y-2"><span>Commitment level</span><Select value={form.commitment_level} onValueChange={(v)=>set({ commitment_level: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["casual","flexible","regular","serious","professional"].map((x)=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></label>
          <label className="space-y-2"><span>Positions available</span><Input type="number" min={1} value={form.positions_available ?? 1} onChange={(e)=>set({ positions_available: Number(e.target.value) })} /></label>
          <label className="space-y-2 sm:col-span-2"><span>Short description</span><Input value={form.short_description ?? ""} onChange={(e)=>set({ short_description: e.target.value })} maxLength={240} /></label>
          <label className="space-y-2 sm:col-span-2"><span>Full description</span><Textarea value={form.description ?? ""} onChange={(e)=>set({ description: e.target.value })} rows={8} /></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={()=>save(false)}>Save draft</Button><Button onClick={()=>save(true)}>Publish vacancy</Button></div>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-3" aria-label="Recruitment pipeline counts">
        {['Active vacancies','Applications','Shortlisted players','Offers sent','Invitations sent','Recruitment history'].map((x)=><div key={x} className="rounded-xl border p-4"><h3 className="font-medium">{x}</h3><p className="text-sm text-muted-foreground">Server-side protected</p></div>)}
      </section>
    </main>
  );
}
