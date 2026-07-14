import { supabase } from '@/integrations/supabase/client';
import type { BandProposalSummary, VoteChoice } from './types';

export async function listBandProposals(bandId: string): Promise<BandProposalSummary[]> {
  const { data, error } = await (supabase as any).rpc('list_band_governance_dashboard', { target_band_id: bandId });
  if (error) throw error;
  return (data ?? []) as unknown as BandProposalSummary[];
}

export async function createBandProposal(input: Record<string, unknown>) {
  const { data, error } = await (supabase as any).rpc('create_band_proposal', { proposal_input: input });
  if (error) throw error;
  return data;
}

export async function castBandProposalVote(proposalId: string, choice: VoteChoice) {
  const { data, error } = await (supabase as any).rpc('cast_band_proposal_vote', { target_proposal_id: proposalId, vote_choice: choice });
  if (error) throw error;
  return data;
}
