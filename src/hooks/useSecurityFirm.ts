import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SecurityFirm, SecurityGuard, SecurityContract } from "@/types/security";

export const useSecurityFirm = (companyId: string | undefined) => {
  return useQuery<SecurityFirm | null>({
    queryKey: ["security-firm", companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from("security_firms")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) throw error;
      return data as SecurityFirm | null;
    },
    enabled: !!companyId,
  });
};

export const useSecurityGuards = (firmId: string | undefined) => {
  return useQuery<SecurityGuard[]>({
    queryKey: ["security-guards", firmId],
    queryFn: async () => {
      if (!firmId) return [];

      const { data, error } = await supabase
        .from("security_guards")
        .select("*")
        .eq("security_firm_id", firmId)
        .order("hired_at", { ascending: false });

      if (error) throw error;
      return data as SecurityGuard[];
    },
    enabled: !!firmId,
  });
};

export const useSecurityContracts = (firmId: string | undefined) => {
  return useQuery<SecurityContract[]>({
    queryKey: ["security-contracts", firmId],
    queryFn: async () => {
      if (!firmId) return [];

      const { data, error } = await supabase
        .from("security_contracts")
        .select("*")
        .eq("security_firm_id", firmId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SecurityContract[];
    },
    enabled: !!firmId,
  });
};

export const useCreateSecurityFirm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, name }: { companyId: string; name: string }) => {
      const { data, error } = await supabase
        .from("security_firms")
        .insert({
          company_id: companyId,
          name,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["security-firm", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Security firm created successfully!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create security firm: ${error.message}`);
    },
  });
};

export const useHireGuard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      firmId,
      name,
      skillLevel,
      salaryPerEvent,
    }: {
      firmId: string;
      name: string;
      skillLevel: number;
      salaryPerEvent: number;
    }) => {
      const { data, error } = await supabase
        .from("security_guards")
        .insert({
          security_firm_id: firmId,
          name,
          skill_level: skillLevel,
          salary_per_event: salaryPerEvent,
          is_npc: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["security-guards", variables.firmId] });
      toast.success("Guard hired successfully!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to hire guard: ${error.message}`);
    },
  });
};

export const useAvailableSecurityFirms = (cityId: string | undefined) => {
  return useQuery<(SecurityFirm & { company_name: string })[]>({
    queryKey: ["available-security-firms", cityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_firms")
        .select(`
          *,
          companies!inner(name, headquarters_city_id, status)
        `)
        .eq("companies.status", "active");

      if (error) throw error;
      
      return (data || []).map((firm: any) => ({
        ...firm,
        company_name: firm.companies?.name || 'Unknown',
      }));
    },
    enabled: true,
  });
};

export const useCreateSecurityContract = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contract: Omit<SecurityContract, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from("security_contracts")
        .insert(contract)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["security-contracts"] });
      toast.success("Security contract created!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create contract: ${error.message}`);
    },
  });
};
