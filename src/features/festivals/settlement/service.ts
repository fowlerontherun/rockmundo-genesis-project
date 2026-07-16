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
  const { data, error } = await settlementClient.rpc('festival_settlement_report', { p_settlement_id: settlementId });
  if (error) throw error;
  const report = data as Partial<SettlementReport> | null;
  if (!report?.settlement) throw new Error('Settlement report projection was empty.');
  return {
    settlement: report.settlement,
    effects: report.effects ?? [],
    contracts: report.contracts ?? [],
    financialResult: report.financialResult ?? null,
    events: report.events ?? [],
  };
};
