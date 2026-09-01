import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BandVacancyCard } from "@/features/band-recruitment/components/BandVacancyCard";
import {
  applyToVacancy,
  searchBandVacancies,
  type BandVacancy,
} from "@/features/band-recruitment/services/recruitment";
import { BAND_PERFORMANCE_ROLES } from "@/data/bandPerformanceRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { getUserBands } from "@/utils/bandStatus";
import { toast } from "sonner";

export default function BandRecruitmentDiscovery() {
  const { profileId, userId } = useActiveProfile();
  const [vacancies, setVacancies] = useState<BandVacancy[]>([]);
  const roles = BAND_PERFORMANCE_ROLES;
  const [instrument, setInstrument] = useState<string>("");
  const [commitment, setCommitment] = useState<string>("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [leaderBandId, setLeaderBandId] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) {
      setLeaderBandId(null);
      return;
    }

    getUserBands(profileId)
      .then((memberships) => {
        const leaderMembership = memberships.find((membership: any) => {
          const band = membership.bands;
          if (!band || band.status === "disbanded") return false;

          return (
            membership.role === "leader" ||
            band.leader_id === profileId ||
            (userId && band.leader_id === userId)
          );
        });

        setLeaderBandId(leaderMembership?.band_id ?? leaderMembership?.bands?.id ?? null);
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

  const quickApply = async (vacancy: BandVacancy) => {
    if (!profileId) {
      toast.error("Select a character before applying to a band.");
      return;
    }
    setApplyingId(vacancy.id);
    try {
      await applyToVacancy(vacancy, profileId, `I'm interested in joining as ${vacancy.instrument}.`);
      toast.success(`Application sent to ${vacancy.bands?.name ?? "the band"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Application failed");
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <main className="container mx-auto max-w-6xl p-4 sm:p-6" aria-labelledby="band-recruitment-title">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Community / Bands</p>
          <h1 id="band-recruitment-title" className="text-3xl font-bold">Band Recruitment</h1>
          <p className="mt-2 text-muted-foreground">Browse roles bands are actively advertising and apply with your currently selected character.</p>
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
          {vacancies.map((vacancy) => (
            <div key={vacancy.id} className={applyingId === vacancy.id ? "pointer-events-none opacity-70" : ""}>
              <BandVacancyCard vacancy={vacancy} onApply={quickApply} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
