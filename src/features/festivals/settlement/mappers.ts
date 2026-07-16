import type { Json } from '@/integrations/supabase/types';
import type { SettlementReadinessSummary } from './types';

const toStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const mapSettlementReadiness = (snapshot: Json): SettlementReadinessSummary => {
  const record = (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) ? snapshot as Record<string, unknown> : {};
  return {
    readyForSettlement: record.ready_for_settlement === true,
    blockers: toStringArray(record.blockers),
    warnings: toStringArray(record.warnings),
    readinessHash: typeof record.readiness_hash === 'string' ? record.readiness_hash : '',
    snapshot,
  };
};
