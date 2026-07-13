import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BandProposalCard } from '@/features/band-governance/components/BandProposalCard';
import { listBandProposals } from '@/features/band-governance/service';

export default function BandGovernanceDashboard() {
  const { bandId } = useParams();
  const { data = [], isLoading, error } = useQuery({ queryKey: ['band-governance', bandId], queryFn: () => listBandProposals(bandId!), enabled: !!bandId });
  const open = data.filter((p) => p.status === 'open');
  const awaiting = open.filter((p) => p.viewer_action_required);
  const drafts = data.filter((p) => p.status === 'draft');
  const failed = data.filter((p) => p.status === 'execution_failed');
  const decided = data.filter((p) => ['passed','rejected','executed','expired'].includes(p.status));
  return <main className="container mx-auto max-w-6xl p-4 sm:p-6 space-y-6" aria-labelledby="governance-title">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">Band management</p><h1 id="governance-title" className="text-3xl font-bold">Governance</h1><p className="text-muted-foreground">Raise proposals, discuss shared decisions, vote, and track execution history.</p></div><Button asChild><Link to="proposals/new">Create proposal</Link></Button></div>
    {isLoading && <p role="status">Loading governance dashboard…</p>}{error && <p role="alert">Governance settings unavailable. Try again later.</p>}
    <section className="grid gap-3 md:grid-cols-5" aria-label="Governance counts">{[['Open proposals', open.length], ['Awaiting your vote', awaiting.length], ['Recently decided', decided.length], ['Draft proposals', drafts.length], ['Failed executions', failed.length]].map(([label, count]) => <Card key={label}><CardHeader><CardTitle>{label}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{count}</p></CardContent></Card>)}</section>
    <section className="space-y-3" aria-labelledby="open-proposals"><h2 id="open-proposals" className="text-xl font-semibold">Open proposals</h2>{open.length ? <div className="grid gap-4 md:grid-cols-2">{open.map((p) => <BandProposalCard key={p.id} proposal={p} />)}</div> : <p className="rounded-lg border p-4 text-muted-foreground">No open proposals. Create a proposal when the band needs a shared decision.</p>}</section>
    <section className="space-y-3" aria-labelledby="history"><h2 id="history" className="text-xl font-semibold">Decision history</h2>{decided.length ? <div className="grid gap-4 md:grid-cols-2">{decided.slice(0, 6).map((p) => <BandProposalCard key={p.id} proposal={p} />)}</div> : <p className="rounded-lg border p-4 text-muted-foreground">No governance history yet.</p>}</section>
  </main>;
}
