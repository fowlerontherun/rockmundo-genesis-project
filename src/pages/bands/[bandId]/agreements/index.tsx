import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { searchProfilesByQuery } from "@/integrations/supabase/friends";
import {
  MusicCollaborationType,
  useBandMusicCollaborationWorkspace,
  useCancelMusicCollaborationContract,
  useCreateMusicCollaborationContract,
  useSettleMusicCollaborationContract,
} from "@/hooks/useMusicCollaborationContracts";

const collaborationLabels: Record<MusicCollaborationType, string> = {
  guest_feature: "Guest feature",
  co_writing: "Co-writing",
  production_credit: "Production credit",
  session_musician: "Session musician",
  tour_participation: "Tour participation",
  live_guest: "Live guest",
};

const lines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);
const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;

export default function BandAgreementsDashboard() {
  const { bandId } = useParams();
  const workspace = useBandMusicCollaborationWorkspace(bandId);
  const createContract = useCreateMusicCollaborationContract();
  const cancelContract = useCancelMusicCollaborationContract();
  const settleContract = useSettleMusicCollaborationContract();

  const [type, setType] = useState<MusicCollaborationType>("session_musician");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [bandObligations, setBandObligations] = useState("Provide the agreed session access and materials");
  const [deliverables, setDeliverables] = useState("Complete the agreed music contribution");
  const [sourceId, setSourceId] = useState("");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [musician, setMusician] = useState<any | null>(null);
  const [role, setRole] = useState("Session musician");
  const [creditRole, setCreditRole] = useState("Performer");
  const [musicianObligations, setMusicianObligations] = useState("Attend and complete the agreed contribution");
  const [royaltyPercent, setRoyaltyPercent] = useState(0);
  const [fixedFee, setFixedFee] = useState(0);

  const data = workspace.data;
  const sourceOptions = useMemo(() => {
    if (!data) return [] as Array<{ id: string; label: string }>;
    if (type === "session_musician" || type === "production_credit") {
      return data.sources.recordingSessions.map((item) => ({ id: item.id, label: `Recording · ${item.status}` }));
    }
    if (type === "tour_participation") {
      return data.sources.tours.map((item) => ({ id: item.id, label: `${item.name} · ${item.status}` }));
    }
    if (type === "live_guest") {
      return data.sources.gigs.map((item) => ({ id: item.id, label: `Gig · ${item.status}${item.scheduledDate ? ` · ${new Date(item.scheduledDate).toLocaleDateString()}` : ""}` }));
    }
    if (type === "co_writing") {
      return data.sources.songwritingProjects.map((item) => ({ id: item.id, label: `${item.title} · ${item.status}` }));
    }
    return data.sources.songs.map((item) => ({ id: item.id, label: `${item.title} · ${item.status}` }));
  }, [data, type]);

  const findPlayers = async () => {
    if (search.trim().length < 2) return;
    setSearching(true);
    try {
      setResults(await searchProfilesByQuery(search.trim(), data?.permissions.profileId ? [data.permissions.profileId] : []));
    } finally {
      setSearching(false);
    }
  };

  const submit = async () => {
    if (!bandId || !musician || !sourceId) return;
    const participantRoyalty = Math.round(Math.max(0, Math.min(100, royaltyPercent)) * 100);
    const payload: any = {
      bandId,
      collaborationType: type,
      title,
      summary,
      bandObligations: lines(bandObligations),
      deliverables: lines(deliverables),
      bandRoyaltyBasisPoints: 10000 - participantRoyalty,
      participants: [{
        profileId: musician.id,
        role,
        creditRole,
        obligations: lines(musicianObligations),
        royaltyBasisPoints: participantRoyalty,
        fixedFeeMinor: Math.round(Math.max(0, fixedFee) * 100),
      }],
    };
    if (type === "session_musician" || type === "production_credit") payload.recordingSessionId = sourceId;
    else if (type === "tour_participation") payload.tourId = sourceId;
    else if (type === "live_guest") payload.gigId = sourceId;
    else if (type === "co_writing") payload.songwritingProjectId = sourceId;
    else payload.songId = sourceId;

    await createContract.mutateAsync(payload);
    setTitle("");
    setSummary("");
    setMusician(null);
    setResults([]);
    setSearch("");
    setSourceId("");
    setRoyaltyPercent(0);
    setFixedFee(0);
  };

  if (workspace.isLoading) return <main className="mx-auto max-w-6xl p-4 md:p-6">Loading band agreements…</main>;
  if (workspace.isError) return <main className="mx-auto max-w-6xl p-4 md:p-6"><p className="text-destructive">{(workspace.error as Error).message}</p><Button className="mt-3" onClick={() => workspace.refetch()}>Retry</Button></main>;
  if (!data) return null;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Band agreements</h1>
        <p className="text-muted-foreground">Membership terms plus server-authoritative guest, writing, production, session and touring collaborations.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link className="rounded-md border px-3 py-2" to={`/bands/${bandId}/agreements/new`}>Member agreement</Link>
        <Link className="rounded-md border px-3 py-2" to={`/bands/${bandId}/leave`}>Departure notice</Link>
      </div>

      {data.permissions.canManage && (
        <Card>
          <CardHeader><CardTitle>Create music collaboration</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm">Type
              <select className="h-10 rounded-md border bg-background px-3" value={type} onChange={(event) => { setType(event.target.value as MusicCollaborationType); setSourceId(""); }}>
                {Object.entries(collaborationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Linked activity
              <select className="h-10 rounded-md border bg-background px-3" value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                <option value="">Choose the authoritative source…</option>
                {sourceOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Title<Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Lead guitar on new single" /></label>
            <label className="grid gap-1 text-sm">Summary<Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What both sides are agreeing to" /></label>
            <label className="grid gap-1 text-sm md:col-span-2">Band obligations<Textarea value={bandObligations} onChange={(event) => setBandObligations(event.target.value)} /></label>
            <label className="grid gap-1 text-sm md:col-span-2">Deliverables<Textarea value={deliverables} onChange={(event) => setDeliverables(event.target.value)} /></label>

            <div className="grid gap-2 md:col-span-2">
              <span className="text-sm font-medium">Musician</span>
              {musician ? (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span>{musician.display_name || musician.username}</span>
                  <Button variant="outline" size="sm" onClick={() => setMusician(null)}>Change</Button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search players" /><Button variant="outline" disabled={searching || search.trim().length < 2} onClick={findPlayers}>{searching ? "Searching…" : "Search"}</Button></div>
                  {results.length > 0 && <div className="grid gap-1 rounded-md border p-2">{results.map((profile) => <button type="button" className="rounded px-3 py-2 text-left hover:bg-muted" key={profile.id} onClick={() => setMusician(profile)}>{profile.display_name || profile.username}</button>)}</div>}
                </>
              )}
            </div>

            <label className="grid gap-1 text-sm">Contract role<Input value={role} onChange={(event) => setRole(event.target.value)} /></label>
            <label className="grid gap-1 text-sm">Public credit<Input value={creditRole} onChange={(event) => setCreditRole(event.target.value)} /></label>
            <label className="grid gap-1 text-sm md:col-span-2">Musician obligations<Textarea value={musicianObligations} onChange={(event) => setMusicianObligations(event.target.value)} /></label>
            <label className="grid gap-1 text-sm">Musician royalty %<Input type="number" min={0} max={100} step={0.01} value={royaltyPercent} onChange={(event) => setRoyaltyPercent(Number(event.target.value))} /></label>
            <label className="grid gap-1 text-sm">Fixed fee ($)<Input type="number" min={0} step={0.01} value={fixedFee} onChange={(event) => setFixedFee(Number(event.target.value))} /></label>
            <div className="md:col-span-2 rounded-md bg-muted p-3 text-sm">Band royalty share: <strong>{Math.max(0, 100 - royaltyPercent).toFixed(2)}%</strong>. Fixed fees are escrowed from band funds when the offer is created.</div>
            <Button className="md:col-span-2" disabled={createContract.isPending || !title.trim() || !summary.trim() || !musician || !sourceId || royaltyPercent < 0 || royaltyPercent > 100} onClick={submit}>{createContract.isPending ? "Creating…" : "Create and fund offer"}</Button>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-3">
        <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Music collaboration contracts</h2><Badge variant="secondary">{data.contracts.length}</Badge></div>
        {data.contracts.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">No collaboration contracts yet.</CardContent></Card> : data.contracts.map((contract) => (
          <Card key={contract.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base"><span>{contract.title}</span><span className="flex gap-2"><Badge variant="secondary">{collaborationLabels[contract.collaborationType]}</Badge><Badge>{contract.status}</Badge></span></CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p className="text-muted-foreground">{contract.summary}</p>
              <div className="grid gap-2 md:grid-cols-2">{contract.credits.map((credit) => <div className="rounded-md border p-3" key={credit.id}><strong>{credit.displayName || credit.username}</strong><div>{credit.creditRole}</div><div>{(credit.royaltyBasisPoints / 100).toFixed(2)}% royalty · {money(credit.fixedFeeMinor)}</div><div className="text-muted-foreground">{credit.obligations.join(" · ")}</div></div>)}</div>
              <div className="text-muted-foreground">Band share {(contract.terms.bandRoyaltyBasisPoints / 100).toFixed(2)}% · {contract.parties.filter((party) => party.partyType === "profile").map((party) => `${party.displayName || party.username}: ${party.status}`).join(" · ")}</div>
              {data.permissions.canManage && <div className="flex flex-wrap gap-2">{["draft", "offered"].includes(contract.status) && <Button variant="outline" disabled={cancelContract.isPending} onClick={() => cancelContract.mutate(contract.id)}>Cancel offer</Button>}{contract.status === "active" && <Button disabled={settleContract.isPending} onClick={() => settleContract.mutate(contract.id)}>Settle from completed activity</Button>}</div>}
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
