import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesInsert } from "@/lib/supabase-types";

export type ArtistLabelContract = Tables<"artist_label_contracts">;
export type ContractClause = Tables<"contract_clauses">;
export type ContractNegotiation = Tables<"contract_negotiations">;

export type NegotiationStatus = "pending" | "countered" | "accepted";

export interface ClauseTerms {
  summary?: string;
  baseline?: string;
  value?: number | string;
  details?: string;
  expectations?: string;
}

export interface NegotiationTerms {
  notes?: string;
  target?: string | number;
  expectations?: string;
}

export interface NegotiationInput {
  clauseId: string;
  proposedTerms: NegotiationTerms;
  counterTerms?: NegotiationTerms;
  status?: NegotiationStatus;
  lastActionBy?: string;
}

const parseJson = <T,>(value: Json | null): T | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as T;
};

export const parseClauseTerms = (value: Json | null): ClauseTerms => {
  return parseJson<ClauseTerms>(value) ?? {};
};

export const parseNegotiationTerms = (value: Json | null): NegotiationTerms => {
  return parseJson<NegotiationTerms>(value) ?? {};
};

export const NEGOTIATION_STATUSES: NegotiationStatus[] = ["pending", "countered", "accepted"];

const deriveNegotiationStatus = (input: NegotiationInput): NegotiationStatus => {
  if (input.status) {
    return input.status;
  }

  if (input.counterTerms && input.counterTerms.notes) {
    return "countered";
  }

  return "pending";
};

export const fetchActiveContracts = async (): Promise<ArtistLabelContract[]> => {
  const { data, error } = await supabase
    .from("artist_label_contracts")
    .select("*")
    .eq("status", "active")
    .order("start_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to load active contracts: ${error.message}`);
  }

  return data ?? [];
};

export const fetchClausesForContract = async (
  contractType: string,
): Promise<ContractClause[]> => {
  const { data, error } = await supabase
    .from("contract_clauses")
    .select("*")
    .eq("contract_type", contractType)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    throw new Error(`Failed to load contract clauses: ${error.message}`);
  }

  return data ?? [];
};

export const fetchNegotiationsForContract = async (
  contractId: string,
): Promise<ContractNegotiation[]> => {
  const { data, error } = await supabase
    .from("contract_negotiations")
    .select("*")
    .eq("contract_id", contractId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load negotiation history: ${error.message}`);
  }

  return data ?? [];
};

export const submitNegotiation = async (
  contractId: string,
  input: NegotiationInput,
): Promise<ContractNegotiation> => {
  const status = deriveNegotiationStatus(input);
  const payload: TablesInsert<"contract_negotiations"> = {
    contract_id: contractId,
    clause_id: input.clauseId,
    status,
    proposed_terms: input.proposedTerms ?? null,
    counter_terms: input.counterTerms ?? null,
    last_action_by: input.lastActionBy ?? "artist",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("contract_negotiations")
    .upsert(payload, { onConflict: "contract_id,clause_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to submit negotiation: ${error.message}`);
  }

  return data;
};
