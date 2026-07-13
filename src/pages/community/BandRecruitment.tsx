import { useEffect, useState } from "react";
import { BandVacancyCard } from "@/features/band-recruitment/components/BandVacancyCard";
import { applyToVacancy, searchBandVacancies, type BandVacancy } from "@/features/band-recruitment/services/recruitment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function BandRecruitmentDiscovery() {
  const [vacancies, setVacancies] = useState<BandVacancy[]>([]);
  const [instrument, setInstrument] = useState<string>("");
  const [commitment, setCommitment] = useState<string>("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    searchBandVacancies({ instrument: instrument || undefined, commitment_level: commitment || undefined })
      .then((rows) => setVacancies(q ? rows.filter((v) => `${v.title} ${v.bands?.name}`.toLowerCase().includes(q.toLowerCase())) : rows))
      .catch((error) => toast.error(error.message ?? "Could not load vacancies"))
      .finally(() => setLoading(false));
  }, [instrument, commitment, q]);

  const quickApply = async (vacancy: BandVacancy) => {
    try { await applyToVacancy(vacancy.id, "I'm interested in this vacancy.", {}); toast.success("Application submitted"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Application failed"); }
  };

  return (
    <main className="container mx-auto max-w-6xl p-4 sm:p-6" aria-labelledby="band-recruitment-title">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Community / Bands</p>
        <h1 id="band-recruitment-title" className="text-3xl font-bold">Band recruitment</h1>
        <p className="mt-2 text-muted-foreground">Browse open positions, filter by role, and apply without exposing hidden skills.</p>
      </div>
      <section className="mb-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4" aria-label="Vacancy filters">
        <Input aria-label="Search by band or vacancy" placeholder="Search band or role" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={instrument || "all"} onValueChange={(v) => setInstrument(v === "all" ? "" : v)}><SelectTrigger aria-label="Instrument"><SelectValue placeholder="Instrument" /></SelectTrigger><SelectContent><SelectItem value="all">All instruments</SelectItem>{["Guitar","Bass","Drums","Keyboard","Other"].map((x)=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
        <Select value={commitment || "all"} onValueChange={(v) => setCommitment(v === "all" ? "" : v)}><SelectTrigger aria-label="Commitment"><SelectValue placeholder="Commitment" /></SelectTrigger><SelectContent><SelectItem value="all">All commitments</SelectItem>{["casual","flexible","regular","serious","professional"].map((x)=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={() => { setQ(""); setInstrument(""); setCommitment(""); }}>Clear filters</Button>
      </section>
      {loading ? <p role="status">Loading open vacancies…</p> : vacancies.length === 0 ? <div className="rounded-xl border p-8 text-center"><h2 className="font-semibold">No matching vacancies</h2><p className="text-muted-foreground">Try broadening requirements or updating your recruitment preferences.</p></div> : <div className="grid gap-4 md:grid-cols-2">{vacancies.map((v) => <BandVacancyCard key={v.id} vacancy={v} onApply={quickApply} />)}</div>}
    </main>
  );
}
