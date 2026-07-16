import { supabase } from '@/integrations/supabase/client';
import type { SettlementReport } from './types';

const settlementClient = supabase as unknown as { rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>; from: (table: string) => any };

export const getFestivalSettlementReadiness = async (editionId: string) => {
  const { data, error } = await settlementClient.rpc('festival_edition_settlement_readiness', { p_edition_id: editionId });
  if (error) throw error;
  return data;
};

export const prepareFestivalEditionSettlement = async (editionId: string, expectedReadinessHash: string, idempotencyKey: string, adminOverrideReason?: string) => {
  const { data, error } = await settlementClient.rpc('prepare_festival_edition_settlement', {
    p_edition_id: editionId,
    p_expected_readiness_hash: expectedReadinessHash,
    p_idempotency_key: idempotencyKey,
    p_admin_override_reason: adminOverrideReason ?? null,
  });
  if (error) throw error;
  return data;
};

export const applyFestivalSettlementBatch = async (settlementId: string, idempotencyKey: string) => {
  const { data, error } = await settlementClient.rpc('apply_festival_settlement_batch', { p_settlement_id: settlementId, p_idempotency_key: idempotencyKey });
  if (error) throw error;
  return data;
};

export const getFestivalSettlementReport = async (settlementId: string): Promise<SettlementReport> => {
  const [settlement, effects, contracts, financialResult, events] = await Promise.all([
    settlementClient.from('festival_edition_settlements').select('*').eq('id', settlementId).single(),
    settlementClient.from('festival_effect_applications').select('*').eq('settlement_id', settlementId),
    settlementClient.from('festival_contract_settlement_instructions').select('*').eq('settlement_id', settlementId),
    settlementClient.from('festival_edition_financial_results').select('*').eq('settlement_id', settlementId).maybeSingle(),
    settlementClient.from('festival_settlement_events').select('*').eq('settlement_id', settlementId).order('created_at'),
  ]);
  for (const result of [settlement, effects, contracts, financialResult, events]) if (result.error) throw result.error;
  return { settlement: settlement.data, effects: effects.data ?? [], contracts: contracts.data ?? [], financialResult: financialResult.data, events: events.data ?? [] };
};
