import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { BAND_PROPOSAL_TYPES, policyForProposalType, type BandProposalType } from '@/features/band-governance/catalog';
import { createBandProposal } from '@/features/band-governance/service';

const proposalTypes = Object.values(BAND_PROPOSAL_TYPES).flat();
export default function NewBandProposalPage() {
  const { bandId } = useParams(); const navigate = useNavigate();
  const [type, setType] = useState<BandProposalType>('accept_gig'); const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [payload, setPayload] = useState('{}'); const [discussion, setDiscussion] = useState(true); const [dirty, setDirty] = useState(false);
  const policy = useMemo(() => policyForProposalType(type), [type]);
  const save = async (status: 'draft'|'open') => { try { const action_payload = JSON.parse(payload || '{}'); await createBandProposal({ band_id: bandId, proposal_type: type, title, description, action_payload, status, discussion_enabled: discussion, policy }); toast.success(status === 'open' ? 'Proposal opened' : 'Draft saved'); setDirty(false); navigate(`/bands/${bandId}/governance`); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save proposal'); } };
  return <main className="container mx-auto max-w-4xl p-4 sm:p-6" aria-labelledby="new-proposal-title"><p className="text-sm text-muted-foreground">Band governance</p><h1 id="new-proposal-title" className="text-3xl font-bold">Create proposal</h1><p className="mt-2 text-muted-foreground">Structured payloads are validated now and revalidated before execution. {dirty && <span role="status">Unsaved changes</span>}</p>
    <section className="mt-6 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
      <Label className="space-y-2"><span>Proposal type</span><Select value={type} onValueChange={(v) => { setType(v as BandProposalType); setDirty(true); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{proposalTypes.map((x) => <SelectItem key={x} value={x}>{x.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select></Label>
      <Label className="space-y-2"><span>Voting deadline</span><Input readOnly value={`${policy.votingDurationHours} hours after opening`} /></Label>
      <Label className="space-y-2 sm:col-span-2"><span>Title</span><Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} maxLength={140} /></Label>
      <Label className="space-y-2 sm:col-span-2"><span>Description</span><Textarea value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} rows={6} /></Label>
      <Label className="space-y-2 sm:col-span-2"><span>Action payload JSON</span><Textarea value={payload} onChange={(e) => { setPayload(e.target.value); setDirty(true); }} rows={8} aria-describedby="payload-help" /><span id="payload-help" className="text-xs text-muted-foreground">Example fields: gig_id, amount_cents, candidate_profile_id, recording_id, proposed_split. Unsafe HTML is not rendered.</span></Label>
      <Label className="flex items-center gap-3"><Switch checked={discussion} onCheckedChange={(v) => { setDiscussion(v); setDirty(true); }} />Discussion enabled</Label>
      <div className="rounded-lg border p-3 text-sm"><strong>Consequences:</strong> {policy.votingMethod.replace(/_/g, ' ')}; quorum {policy.quorumType} {policy.quorumValue}; threshold {Math.round(policy.approvalThreshold * 100)}%. Passed proposals enter separate execution and may fail safely.</div>
    </section><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={() => save('draft')}>Save draft</Button><Button onClick={() => save('open')}>Preview and open vote</Button></div></main>;
}
