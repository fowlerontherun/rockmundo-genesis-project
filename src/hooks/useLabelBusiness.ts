import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LabelFinancialTransaction, LabelStaff, LabelDistributionDeal } from "@/types/label-business";

export function useLabelFinancials(labelId: string | undefined) {
  return useQuery({
    queryKey: ['label-financials', labelId],
    queryFn: async () => {
      if (!labelId) return [];
      const { data, error } = await supabase
        .from('label_financial_transactions')
        .select('*')
        .eq('label_id', labelId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as LabelFinancialTransaction[];
    },
    enabled: !!labelId,
  });
}

export function useAddLabelTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (transaction: {
      label_id: string;
      transaction_type: string;
      amount: number;
      description?: string;
      related_release_id?: string | null;
      related_band_id?: string | null;
      related_contract_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('label_financial_transactions')
        .insert(transaction)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['label-financials', variables.label_id] });
      toast.success("Transaction recorded");
    },
    onError: (error) => {
      toast.error(`Failed to record transaction: ${error.message}`);
    },
  });
}

export function useLabelStaff(labelId: string | undefined) {
  return useQuery({
    queryKey: ['label-staff', labelId],
    queryFn: async () => {
      if (!labelId) return [];
      const { data, error } = await supabase
        .from('label_staff')
        .select('*')
        .eq('label_id', labelId)
        .order('role');
      
      if (error) throw error;
      return data as LabelStaff[];
    },
    enabled: !!labelId,
  });
}

export function useHireLabelStaff() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (staff: {
      label_id: string;
      name: string;
      role: string;
      skill_level?: number;
      specialty_genre?: string;
      salary_monthly?: number;
    }) => {
      const { data, error } = await supabase
        .from('label_staff')
        .insert(staff)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['label-staff', variables.label_id] });
      toast.success("Staff member hired!");
    },
    onError: (error) => {
      toast.error(`Failed to hire staff: ${error.message}`);
    },
  });
}

export function useFireLabelStaff() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ staffId, labelId }: { staffId: string; labelId: string }) => {
      const { error } = await supabase
        .from('label_staff')
        .delete()
        .eq('id', staffId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['label-staff', variables.labelId] });
      toast.success("Staff member released");
    },
    onError: (error) => {
      toast.error(`Failed to release staff: ${error.message}`);
    },
  });
}

export function useLabelDistributionDeals(labelId: string | undefined) {
  return useQuery({
    queryKey: ['label-distribution-deals', labelId],
    queryFn: async () => {
      if (!labelId) return [];
      const { data, error } = await supabase
        .from('label_distribution_deals')
        .select('*')
        .eq('label_id', labelId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as LabelDistributionDeal[];
    },
    enabled: !!labelId,
  });
}

export function useCreateDistributionDeal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (deal: {
      label_id: string;
      distributor_name: string;
      deal_type: string;
      revenue_share_pct: number;
      advance_amount?: number;
      minimum_releases?: number;
      territories?: string[];
    }) => {
      const { data, error } = await supabase
        .from('label_distribution_deals')
        .insert(deal)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['label-distribution-deals', variables.label_id] });
      toast.success("Distribution deal created!");
    },
    onError: (error) => {
      toast.error(`Failed to create deal: ${error.message}`);
    },
  });
}

export function useTransferLabelToCompany() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ labelId, companyId }: { labelId: string; companyId: string }) => {
      const { data, error } = await supabase
        .from('labels')
        .update({ 
          company_id: companyId,
          is_subsidiary: true 
        })
        .eq('id', labelId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
      queryClient.invalidateQueries({ queryKey: ['company-labels'] });
      toast.success("Label transferred to company!");
    },
    onError: (error) => {
      toast.error(`Failed to transfer label: ${error.message}`);
    },
  });
}
