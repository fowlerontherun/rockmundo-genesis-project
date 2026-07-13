import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { calculateVoteResult } from '../voting';
import { DEFAULT_GOVERNANCE_POLICY } from '../catalog';
import type { BandProposalSummary } from '../types';

export function BandProposalCard({ proposal }: { proposal: BandProposalSummary }) {
  const tally = proposal.vote_summary ?? { yes: 0, no: 0, abstain: 0, eligible: 0 };
  const result = calculateVoteResult(DEFAULT_GOVERNANCE_POLICY, tally);
  const pct = tally.eligible ? Math.round((result.votesCast / tally.eligible) * 100) : 0;
  return (
    <Card aria-labelledby={`proposal-${proposal.id}`}>
      <CardHeader><CardTitle id={`proposal-${proposal.id}`}>{proposal.title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2"><Badge>{proposal.status.replace('_', ' ')}</Badge><Badge variant="outline">{proposal.proposal_type.replace(/_/g, ' ')}</Badge>{proposal.viewer_action_required && <Badge variant="destructive">Your vote needed</Badge>}</div>
        <p className="text-sm text-muted-foreground">Votes: {tally.yes} yes · {tally.no} no · {tally.abstain} abstain. Quorum {result.votesCast}/{result.quorumTarget}.</p>
        <Progress value={pct} aria-label={`Quorum progress ${result.votesCast} of ${result.quorumTarget} votes cast`} />
        {proposal.closes_at && <p className="text-xs text-muted-foreground">Voting closes <time dateTime={proposal.closes_at}>{new Date(proposal.closes_at).toLocaleString()}</time></p>}
        {proposal.execution_error && <p role="alert" className="text-sm text-destructive">Execution failed: {proposal.execution_error}</p>}
      </CardContent>
      <CardFooter className="gap-2"><Button asChild size="sm"><Link to={`proposals/${proposal.id}`}>View</Link></Button>{proposal.status === 'draft' && <Button asChild size="sm" variant="outline"><Link to={`proposals/new?draft=${proposal.id}`}>Edit draft</Link></Button>}</CardFooter>
    </Card>
  );
}
