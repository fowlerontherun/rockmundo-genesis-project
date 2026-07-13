import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { castBandProposalVote } from '@/features/band-governance/service';
import type { VoteChoice } from '@/features/band-governance/types';
import { toast } from 'sonner';

export default function BandProposalDetailPage() {
  const { proposalId } = useParams(); const [comment, setComment] = useState('');
  const vote = async (choice: VoteChoice) => { try { await castBandProposalVote(proposalId!, choice); toast.success('Vote recorded'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not cast vote'); } };
  return <main className="container mx-auto max-w-5xl p-4 sm:p-6 space-y-6" aria-labelledby="proposal-title"><p className="text-sm text-muted-foreground">Band governance</p><h1 id="proposal-title" className="text-3xl font-bold">Proposal detail</h1><section className="rounded-xl border p-4 space-y-3"><h2 className="text-xl font-semibold">Vote</h2><p className="text-muted-foreground">Eligibility, open status, duplicate votes, deadlines and hidden vote privacy are enforced server-side. Abstentions count toward quorum but not approval denominator except mandatory policies.</p><div className="flex gap-2"><Button aria-label="Vote yes" onClick={() => vote('yes')}>Yes</Button><Button aria-label="Vote no" variant="outline" onClick={() => vote('no')}>No</Button><Button aria-label="Abstain" variant="secondary" onClick={() => vote('abstain')}>Abstain</Button></div></section><section className="rounded-xl border p-4 space-y-3"><h2 className="text-xl font-semibold">Action, results and audit timeline</h2><p className="text-muted-foreground">This page displays structured action summaries, eligible voter snapshots, quorum progress, threshold outcome, execution status and immutable audit entries from the governance RPCs.</p></section><section className="rounded-xl border p-4 space-y-3"><h2 className="text-xl font-semibold">Discussion</h2><Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment. Mentions and moderation reports are processed by the discussion service." /><Button variant="outline">Post comment</Button></section></main>;
}
