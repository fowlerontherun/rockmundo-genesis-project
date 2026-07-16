import type { Json } from '@/integrations/supabase/types';

export type FestivalSettlementStatus =
  | 'not_ready' | 'ready' | 'preparing' | 'locked' | 'applying_effects'
  | 'settling_contracts' | 'settling_revenue' | 'reconciling' | 'completed'
  | 'failed' | 'partially_failed' | 'cancelled' | 'superseded';

export type FestivalSettlement = Record<string, unknown> & { id: string; edition_id: string; status: FestivalSettlementStatus };
export type FestivalSettlementEvent = Record<string, unknown> & { id: string; settlement_id: string; event_type: string };
export type FestivalEffectApplication = Record<string, unknown> & { id: string; settlement_id: string; effect_type: string; application_status: string };
export type FestivalContractSettlementInstruction = Record<string, unknown> & { id: string; settlement_id: string; contract_id: string; status: string };
export type FestivalFinancialResult = Record<string, unknown> & { id: string; settlement_id: string; currency_code: string };

export interface SettlementReadinessSummary {
  readyForSettlement: boolean;
  blockers: string[];
  warnings: string[];
  readinessHash: string;
  snapshot: Json;
}

export interface SettlementReport {
  settlement: FestivalSettlement;
  effects: FestivalEffectApplication[];
  contracts: FestivalContractSettlementInstruction[];
  financialResult: FestivalFinancialResult | null;
  events: FestivalSettlementEvent[];
}
