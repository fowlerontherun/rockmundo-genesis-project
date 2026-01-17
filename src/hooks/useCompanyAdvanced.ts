import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  CompanyFinancialReport,
  CompanyKPI,
  CompanySynergy,
  CompanyGoal,
  CompanyNotification,
  CompanyInternalService,
} from "@/types/company-advanced";

// Financial Reports
export function useCompanyFinancialReports(companyId?: string) {
  return useQuery({
    queryKey: ["company-financial-reports", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_financial_reports")
        .select("*")
        .eq("company_id", companyId!)
        .order("report_period", { ascending: false })
        .limit(12);

      if (error) throw error;
      return data as CompanyFinancialReport[];
    },
    enabled: !!companyId,
  });
}

// KPIs
export function useCompanyKPIs(companyId?: string) {
  return useQuery({
    queryKey: ["company-kpis", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_kpis")
        .select("*")
        .eq("company_id", companyId!)
        .order("metric_date", { ascending: false })
        .limit(30);

      if (error) throw error;
      return data as CompanyKPI[];
    },
    enabled: !!companyId,
  });
}

// Synergies
export function useCompanySynergies(companyId?: string) {
  return useQuery({
    queryKey: ["company-synergies", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_synergies")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CompanySynergy[];
    },
    enabled: !!companyId,
  });
}

// Goals
export function useCompanyGoals(companyId?: string) {
  return useQuery({
    queryKey: ["company-goals", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_goals")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CompanyGoal[];
    },
    enabled: !!companyId,
  });
}

// Notifications
export function useCompanyNotifications(companyId?: string, unreadOnly = false) {
  return useQuery({
    queryKey: ["company-notifications", companyId, unreadOnly],
    queryFn: async () => {
      let query = supabase
        .from("company_notifications")
        .select("*")
        .eq("company_id", companyId!)
        .eq("is_dismissed", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (unreadOnly) {
        query = query.eq("is_read", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CompanyNotification[];
    },
    enabled: !!companyId,
  });
}

// Internal Services
export function useCompanyInternalServices(companyId?: string) {
  return useQuery({
    queryKey: ["company-internal-services", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_internal_services")
        .select("*")
        .eq("company_id", companyId!)
        .order("service_date", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as CompanyInternalService[];
    },
    enabled: !!companyId,
  });
}

// Mutations
export function useCreateCompanyGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<CompanyGoal>) => {
      const { data: result, error } = await supabase
        .from("company_goals")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["company-goals", variables.company_id] });
    },
  });
}

export function useUpdateGoalProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId, currentValue, status }: { goalId: string; currentValue: number; status?: string }) => {
      const updateData: Record<string, any> = { current_value: currentValue };
      if (status) {
        updateData.status = status;
        if (status === 'completed') {
          updateData.completed_at = new Date().toISOString();
        }
      }

      const { data: result, error } = await supabase
        .from("company_goals")
        .update(updateData)
        .eq("id", goalId)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-goals"] });
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("company_notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-notifications"] });
    },
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("company_notifications")
        .update({ is_dismissed: true })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-notifications"] });
    },
  });
}

export function useActivateSynergy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<CompanySynergy>) => {
      const { data: result, error } = await supabase
        .from("company_synergies")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["company-synergies", variables.company_id] });
    },
  });
}

export function useRecordInternalService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<CompanyInternalService>) => {
      const { data: result, error } = await supabase
        .from("company_internal_services")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["company-internal-services", variables.company_id] });
    },
  });
}
