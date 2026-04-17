import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CityLaws, ProposedPolicies } from "@/types/city-governance";

export type PromiseStatus = "fulfilled" | "in_progress" | "broken" | "untouched";

export interface MayorPromise {
  field: keyof ProposedPolicies;
  promised: unknown;
  current: unknown;
  baseline: unknown; // value at term start
  status: PromiseStatus;
  numericProgressPct?: number; // 0-100 where applicable
}

export interface MayorPromiseReport {
  mayorId: string;
  electionId: string | null;
  candidateId: string | null;
  promises: MayorPromise[];
  fulfillmentScore: number; // 0-100
  fulfilledCount: number;
  inProgressCount: number;
  brokenCount: number;
  untouchedCount: number;
  totalPromises: number;
}

const NUMERIC_FIELDS: Array<keyof ProposedPolicies> = [
  "income_tax_rate",
  "sales_tax_rate",
  "travel_tax",
  "alcohol_legal_age",
  "noise_curfew_hour",
  "busking_license_fee",
  "venue_permit_cost",
  "max_concert_capacity",
  "community_events_funding",
];

function classify(
  field: keyof ProposedPolicies,
  promised: unknown,
  current: unknown,
  baseline: unknown,
): { status: PromiseStatus; pct?: number } {
  if (promised === undefined || promised === null) {
    return { status: "untouched" };
  }

  // Exact match for booleans, strings, drug_policy
  if (typeof promised === "boolean" || typeof promised === "string") {
    if (current === promised) return { status: "fulfilled", pct: 100 };
    if (current !== baseline) return { status: "in_progress", pct: 50 };
    return { status: "untouched", pct: 0 };
  }

  // Array fields (genres)
  if (Array.isArray(promised)) {
    const cur = Array.isArray(current) ? current : [];
    const base = Array.isArray(baseline) ? baseline : [];
    const promisedSet = new Set(promised.map(String));
    const curSet = new Set(cur.map(String));
    const baseSet = new Set(base.map(String));

    if (
      promisedSet.size === curSet.size &&
      [...promisedSet].every((v) => curSet.has(v))
    ) {
      return { status: "fulfilled", pct: 100 };
    }
    const overlap = [...promisedSet].filter((v) => curSet.has(v)).length;
    const baseOverlap = [...promisedSet].filter((v) => baseSet.has(v)).length;
    if (overlap > baseOverlap) {
      const pct = Math.round((overlap / Math.max(1, promisedSet.size)) * 100);
      return { status: "in_progress", pct };
    }
    return { status: "untouched", pct: 0 };
  }

  // Numeric fields
  if (typeof promised === "number") {
    const cur = typeof current === "number" ? current : Number(current ?? 0);
    const base = typeof baseline === "number" ? baseline : Number(baseline ?? 0);

    const targetDelta = Math.abs(promised - base);
    if (targetDelta === 0) {
      // Promised the status quo
      return cur === promised
        ? { status: "fulfilled", pct: 100 }
        : { status: "broken", pct: 0 };
    }

    const closenessTarget = Math.abs(promised - cur);
    const pct = Math.max(0, Math.min(100, Math.round((1 - closenessTarget / targetDelta) * 100)));

    if (pct >= 95) return { status: "fulfilled", pct: 100 };

    // Determine direction of movement
    const promisedUp = promised > base;
    const movedUp = cur > base;
    const movedDown = cur < base;

    if ((promisedUp && movedDown) || (!promisedUp && movedUp)) {
      // Moved opposite to the promise — broken trust
      return { status: "broken", pct: 0 };
    }
    if (cur !== base) return { status: "in_progress", pct };
    return { status: "untouched", pct: 0 };
  }

  return { status: "untouched" };
}

/**
 * Fetches the active mayor's winning candidacy and computes promise fulfillment
 * by comparing proposed_policies vs current city_laws using the laws-at-term-start
 * snapshot derived from city_law_history.
 */
export function useMayorPromiseReport(cityId: string | undefined) {
  return useQuery({
    queryKey: ["mayor-promise-report", cityId],
    queryFn: async (): Promise<MayorPromiseReport | null> => {
      if (!cityId) return null;

      // 1. Active mayor
      const { data: mayor } = await supabase
        .from("city_mayors")
        .select("id, election_id, term_start, profile_id")
        .eq("city_id", cityId)
        .eq("is_current", true)
        .maybeSingle();
      if (!mayor) return null;

      // 2. Winning candidacy → proposed policies
      let proposed: ProposedPolicies = {};
      let candidateId: string | null = null;
      if (mayor.election_id) {
        const { data: candidate } = await supabase
          .from("city_candidates")
          .select("id, proposed_policies")
          .eq("election_id", mayor.election_id)
          .eq("profile_id", mayor.profile_id)
          .maybeSingle();
        if (candidate) {
          candidateId = candidate.id;
          proposed = (candidate.proposed_policies || {}) as ProposedPolicies;
        }
      }

      // 3. Current laws
      const { data: laws } = await supabase
        .from("city_laws")
        .select("*")
        .eq("city_id", cityId)
        .is("effective_until", null)
        .maybeSingle();

      // 4. Reconstruct baseline-at-term-start from law_history (if any changes since term start)
      const baseline: Partial<CityLaws> = { ...(laws as CityLaws | null) } as Partial<CityLaws>;
      const { data: history } = await supabase
        .from("city_law_history")
        .select("law_field, old_value, new_value, changed_at, mayor_id")
        .eq("city_id", cityId)
        .eq("mayor_id", mayor.id)
        .order("changed_at", { ascending: true });

      // For every field changed by THIS mayor, the earliest old_value is the baseline
      const earliestOld: Record<string, string> = {};
      for (const row of history ?? []) {
        if (!(row.law_field in earliestOld)) {
          earliestOld[row.law_field] = row.old_value ?? "";
        }
      }
      for (const [field, oldStr] of Object.entries(earliestOld)) {
        const promisedVal = (proposed as Record<string, unknown>)[field];
        if (Array.isArray(promisedVal)) {
          try {
            (baseline as Record<string, unknown>)[field] = JSON.parse(oldStr);
          } catch {
            (baseline as Record<string, unknown>)[field] = oldStr.split(",").filter(Boolean);
          }
        } else if (typeof promisedVal === "boolean") {
          (baseline as Record<string, unknown>)[field] = oldStr === "true";
        } else if (typeof promisedVal === "number") {
          (baseline as Record<string, unknown>)[field] = Number(oldStr);
        } else {
          (baseline as Record<string, unknown>)[field] = oldStr;
        }
      }

      // 5. Build promise rows
      const promises: MayorPromise[] = Object.entries(proposed)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([field, promisedVal]) => {
          const current = (laws as Record<string, unknown> | null)?.[field];
          const base = (baseline as Record<string, unknown>)[field];
          const { status, pct } = classify(
            field as keyof ProposedPolicies,
            promisedVal,
            current,
            base,
          );
          return {
            field: field as keyof ProposedPolicies,
            promised: promisedVal,
            current,
            baseline: base,
            status,
            numericProgressPct: pct,
          };
        });

      const fulfilled = promises.filter((p) => p.status === "fulfilled").length;
      const inProgress = promises.filter((p) => p.status === "in_progress").length;
      const broken = promises.filter((p) => p.status === "broken").length;
      const untouched = promises.filter((p) => p.status === "untouched").length;

      // Score: fulfilled=100, in_progress weighted by pct, broken=0, untouched=0
      let scoreSum = 0;
      for (const p of promises) {
        if (p.status === "fulfilled") scoreSum += 100;
        else if (p.status === "in_progress") scoreSum += p.numericProgressPct ?? 50;
      }
      const score = promises.length === 0 ? 0 : Math.round(scoreSum / promises.length);

      // Suppress unused-var warning for NUMERIC_FIELDS reference
      void NUMERIC_FIELDS;

      return {
        mayorId: mayor.id,
        electionId: mayor.election_id ?? null,
        candidateId,
        promises,
        fulfillmentScore: score,
        fulfilledCount: fulfilled,
        inProgressCount: inProgress,
        brokenCount: broken,
        untouchedCount: untouched,
        totalPromises: promises.length,
      };
    },
    enabled: !!cityId,
  });
}
