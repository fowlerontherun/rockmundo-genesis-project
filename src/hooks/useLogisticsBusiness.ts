import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deductCompanyBalance, getCompanyIdFromLogistics, COMPANY_BALANCE_QUERY_KEYS } from "./useCompanyBalanceDeduction";
import type {
  LogisticsCompany,
  LogisticsFleetVehicle,
  LogisticsDriver,
  LogisticsContract,
  LogisticsTransaction,
  LogisticsUpgrade,
} from "@/types/logistics-business";

export function useLogisticsCompanies(companyId?: string) {
  return useQuery({
    queryKey: ["logistics-companies", companyId],
    queryFn: async () => {
      let query = supabase
        .from("logistics_companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as LogisticsCompany[];
    },
    enabled: !!companyId,
  });
}

// Single logistics company lookup with dual ID pattern (by id OR company_id)
export function useLogisticsCompanyById(idOrCompanyId?: string) {
  return useQuery({
    queryKey: ["logistics-company", idOrCompanyId],
    queryFn: async () => {
      if (!idOrCompanyId) return null;
      
      // Dual lookup pattern: try by id OR company_id for subsidiary navigation
      const { data, error } = await supabase
        .from("logistics_companies")
        .select("*")
        .or(`id.eq.${idOrCompanyId},company_id.eq.${idOrCompanyId}`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as LogisticsCompany | null;
    },
    enabled: !!idOrCompanyId,
  });
}

export function useLogisticsFleet(logisticsCompanyId?: string) {
  return useQuery({
    queryKey: ["logistics-fleet", logisticsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logistics_fleet_vehicles")
        .select("*")
        .eq("logistics_company_id", logisticsCompanyId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LogisticsFleetVehicle[];
    },
    enabled: !!logisticsCompanyId,
  });
}

export function useLogisticsDrivers(logisticsCompanyId?: string) {
  return useQuery({
    queryKey: ["logistics-drivers", logisticsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logistics_drivers")
        .select("*")
        .eq("logistics_company_id", logisticsCompanyId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LogisticsDriver[];
    },
    enabled: !!logisticsCompanyId,
  });
}

export function useLogisticsContracts(logisticsCompanyId?: string) {
  return useQuery({
    queryKey: ["logistics-contracts", logisticsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logistics_contracts")
        .select("*")
        .eq("logistics_company_id", logisticsCompanyId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LogisticsContract[];
    },
    enabled: !!logisticsCompanyId,
  });
}

export function useLogisticsTransactions(logisticsCompanyId?: string) {
  return useQuery({
    queryKey: ["logistics-transactions", logisticsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logistics_transactions")
        .select("*")
        .eq("logistics_company_id", logisticsCompanyId!)
        .order("transaction_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as LogisticsTransaction[];
    },
    enabled: !!logisticsCompanyId,
  });
}

export function useLogisticsUpgrades(logisticsCompanyId?: string) {
  return useQuery({
    queryKey: ["logistics-upgrades", logisticsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logistics_upgrades")
        .select("*")
        .eq("logistics_company_id", logisticsCompanyId!)
        .order("purchased_at", { ascending: false });

      if (error) throw error;
      return data as LogisticsUpgrade[];
    },
    enabled: !!logisticsCompanyId,
  });
}

// Mutations
export function useCreateLogisticsCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<LogisticsCompany>) => {
      const { data: result, error } = await supabase
        .from("logistics_companies")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logistics-companies"] });
    },
  });
}

export function useAddFleetVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<LogisticsFleetVehicle> & { request_id: string }) => {
      if (!data.logistics_company_id) throw new Error("Missing logistics company ID");
      const { data: result, error } = await (supabase as any).rpc("purchase_logistics_fleet_vehicle_atomic", {
        p_logistics_id: data.logistics_company_id,
        p_vehicle: data,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["logistics-fleet", variables.logistics_company_id] });
    },
  });
}

export function useHireDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<LogisticsDriver> & { request_id: string }) => {
      if (!data.logistics_company_id) throw new Error("Missing logistics company ID");
      const { data: result, error } = await (supabase as any).rpc("hire_logistics_driver_atomic", {
        p_logistics_id: data.logistics_company_id,
        p_driver: data,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["logistics-drivers", variables.logistics_company_id] });
      COMPANY_BALANCE_QUERY_KEYS.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
}

export function useCreateLogisticsContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<LogisticsContract>) => {
      const { data: result, error } = await supabase
        .from("logistics_contracts")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["logistics-contracts", variables.logistics_company_id] });
    },
  });
}

export function useUpdateContractStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contractId, status }: { contractId: string; status: string }) => {
      const { data: previous, error: readError } = await supabase.from("logistics_contracts").select("status").eq("id",contractId).single();
      if (readError) throw readError;
      const transitions: Record<string,string[]>={pending:["active","cancelled"],active:["completed","cancelled"],completed:[],cancelled:[]};
      if (!(transitions[previous.status] ?? []).includes(status)) throw new Error("Contract status is no longer eligible for this change.");
      const { data: result, error } = await supabase
        .from("logistics_contracts")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", contractId)
        .eq("status", previous.status)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logistics-contracts"] });
    },
  });
}

export function usePurchaseLogisticsUpgrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<LogisticsUpgrade>) => {
      if (!data.logistics_company_id) throw new Error("Missing logistics company ID");
      if (!data.upgrade_type) throw new Error("Missing upgrade type");
      const { data: result, error } = await (supabase as any).rpc("purchase_logistics_upgrade_atomic", {
        p_logistics_id: data.logistics_company_id,
        p_upgrade_type: data.upgrade_type,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["logistics-upgrades", variables.logistics_company_id] });
      COMPANY_BALANCE_QUERY_KEYS.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });
}

export function useRecordLogisticsTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<LogisticsTransaction>) => {
      const { data: result, error } = await supabase
        .from("logistics_transactions")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["logistics-transactions", variables.logistics_company_id] });
    },
  });
}
