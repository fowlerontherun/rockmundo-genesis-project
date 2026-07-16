import type { Json } from '@/integrations/supabase/types';
import type { SettlementReadinessSummary } from './types';

const toStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const hashSettlementReadiness = (snapshot: Json): string => {
  const source = JSON.stringify(snapshot ?? {});
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) hash = Math.imul(31, hash) + source.charCodeAt(index) | 0;
  return Math.abs(hash).toString(16);
};

export const mapSettlementReadiness = (snapshot: Json): SettlementReadinessSummary => {
  const record = (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) ? snapshot as Record<string, unknown> : {};
  return {
    readyForSettlement: record.ready_for_settlement === true,
    blockers: toStringArray(record.blockers),
    warnings: toStringArray(record.warnings),
    readinessHash: hashSettlementReadiness(snapshot),
    snapshot,
  };
};
