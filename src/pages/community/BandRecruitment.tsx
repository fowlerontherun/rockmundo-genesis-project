import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BandVacancyCard } from "@/features/band-recruitment/components/BandVacancyCard";
import {
  applyToVacancy,
  searchBandVacancies,
  type BandVacancy,
} from "@/features/band-recruitment/services/recruitment";
import { BAND_PERFORMANCE_ROLES } from "@/data/bandPerformanceRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { getUserBands } from "@/utils/bandStatus";
import { toast } from "sonner";

export default function BandRecruitmentDiscovery() {
  const { profileId, userId } = useActiveProfile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vacancies, setVacancies] = useState<BandVacancy[]>([]);
  const roles = BAND_PERFORMANCE_ROLES;
  const [instrument, setInstrument] = useState<string>("");
  const [commitment, setCommitment] = useState<string>("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [coverMessage, setCoverMessage] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [leaderBandId, setLeaderBandId] = useState<string | null>(null);

  const selectedVacancy = useMemo(() => {
    const vacancyId = searchParams.get("vacancy");
    return vacancyId ? vacancies.find((vacancy) => vacancy.id === vacancyId) ?? null : null;
  }, [searchParams, vacancies]);

  useEffect(() => {
    if (!profileId) {
      setLeaderBandId(null);
      return;
    }

    getUserBands(profileId)
      .then((memberships) => {
        const managementMembership = memberships.find((membership: any) => {
          const band = membership.bands;
          if (!band || band.status === "disbanded") return false;
          return ["leader", "founder", "co-leader", "co_leader", "manager", "recruiter"].includes(String(membership.role ?? "").toLowerCase())
            || band.leader_id === profileId
            || (userId && band.leader_id === userId);
        });
        setLeaderBandId(managementMembership?.band_id ?? managementMembership?.bands?.id ?? null);
      })
      .catch(() => setLeaderBandId(null));
  }, [profileId, userId]);

  useEffect(() => {
    setLoading(true);
    searchBandVacancies({ instrument: instrument || undefined, commitment_level: commitment || undefined })
      .then((rows) => setVacancies(q ? rows.filter((v) => `${v.title} ${v.instrument} ${v.bands?.name ?? ""}`.toLowerCase().includes(q.toLowerCase())) : rows))
      .catch((error) => toast.error(error.message ?? "Could not load vacancies"))
      .finally(() => setLoading(false));
  }, [instrument, commitment, q]);

  useEffect(() => {
    setCoverMessage("");
    setAnswers({});
  }, [selectedVacancy?.id]);

  const openVacancy = (vacancy: BandVacancy) => {
    const next = new URLSearchParams(searchParams);
    next.set("vacancy", vacancy.id);
    setSearchParams(next);
  };

  const closeVacancy = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("vacancy");
    setSearchParams(next, { replace: true });
  };

  const submitApplication = async () => {
    if (!selectedVacancy) return;
    if (!profileId) {
      toast.error("Select a character before applying to a band.");
      return;
    }
    setApplying(true);
    try {
      await applyToVacancy(selectedVacancy, profileId, coverMessage, answers);
      toast.success(`Application sent to ${selectedVacancy.bands?.name ?? "the band"}`);
      closeVacancy();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Application failed");
    } finally {
      setApplying(false);
    }
  };

  return (
    <main className="container mx-auto max-w-6xl p-4 sm:p-6" aria-labelledby="band-recruitment-title">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Community / Bands</p>
          <h1 id="band-recruitment-title" className="text-3xl font-bold">Band Recruitment</h1>
          <p className="mt-2 text-muted-foreground">Browse active adverts, review the full requirements and apply with your currently selected character.</p>
        </div>
        {leaderBandId && (
          <Button asChild>
            <Link to={`/bands/${leaderBandId}/recruitment`}>Advertise a band role</Link>
          </Button>
        )}
      </div>

      <section className="mb-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4" aria-label="Vacancy filters">
        <Input aria-label="Search by band or vacancy" placeholder="Search band or role" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={instrument || "all"} onValueChange={(v) => setInstrument(v === "all" ? "" : v)}>
          <SelectTrigger aria-label="Role"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All roles</SelectItem>{roles.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={commitment || "all"} onValueChange={(v) => setCommitment(v === "all" ? "" : v)}>
          <SelectTrigger aria-label="Commitment"><SelectValue placeholder="Commitment" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All commitments</SelectItem>{["casual", "flexible", "regular", "serious", "professional"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" onClick={() => { setQ(""); setInstrument(""); setCommitment(""); }}>Clear filters</Button>
      </section>

      {loading ? (
        <p role="status">Loading open roles…</p>
      ) : vacancies.length === 0 ? (
        <div className="rounded-xl border p-8 text-center">
          <h2 className="font-semibold">No matching band roles</h2>
          <p className="text-muted-foreground">Try another instrument or commitment level.</p>
          {leaderBandId && (
            <Button asChild className="mt-4">
              <Link to={`/bands/${leaderBandId}/recruitment`}>Advertise the first role</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {vacancies.map((vacancy) => <BandVacancyCard key={vacancy.id} vacancy={vacancy} onApply={openVacancy} />)}
        </div>
      )}

      <Dialog open={!!selectedVacancy} onOpenChange={(open) => { if (!open) closeVacancy(); }}>
        {selectedVacancy && (
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedVacancy.title}</DialogTitle>
              <DialogDescription>{selectedVacancy.bands?.name ?? "Band"} • {selectedVacancy.instrument} • {selectedVacancy.commitment_level}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {selectedVacancy.description && <p className="whitespace-pre-wrap text-sm">{selectedVacancy.description}</p>}
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm sm:grid-cols-4">
                <div><span className="text-muted-foreground">Positions</span><div>{Math.max(0, selectedVacancy.positions_available - selectedVacancy.positions_filled)} remaining</div></div>
                <div><span className="text-muted-foreground">Audition</span><div>{selectedVacancy.audition_required ? "Required" : "Not required"}</div></div>
                <div><span className="text-muted-foreground">Travel</span><div>{selectedVacancy.remote_or_travel_allowed ? "Allowed" : "Local only"}</div></div>
                <div><span className="text-muted-foreground">Deadline</span><div>{selectedVacancy.application_deadline ? new Date(selectedVacancy.application_deadline).toLocaleDateString() : "None"}</div></div>
              </div>

              <label className="block space-y-2">
                <span className="font-medium">Application message</span>
                <Textarea value={coverMessage} onChange={(e) => setCoverMessage(e.target.value)} maxLength={500} rows={5} placeholder="Tell the band why you'd be a good fit, your availability and relevant experience." />
                <span className="text-xs text-muted-foreground">{coverMessage.length}/500</span>
              </label>

              {(selectedVacancy.application_questions ?? []).map((question) => question.prompt ? (
                <label key={question.prompt} className="block space-y-2">
                  <span className="font-medium">{question.prompt}{question.required !== false ? " *" : ""}</span>
                  <Textarea value={answers[question.prompt] ?? ""} onChange={(e) => setAnswers((current) => ({ ...current, [question.prompt!]: e.target.value }))} maxLength={1000} rows={3} />
                </label>
              ) : null)}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeVacancy} disabled={applying}>Cancel</Button>
                <Button onClick={submitApplication} disabled={applying || !selectedVacancy.direct_applications_allowed}>{applying ? "Sending…" : "Send application"}</Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
}
