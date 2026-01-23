import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/components/ui/use-toast";
import type { Company, CreateCompanyInput, CompanyFinancialSummary } from "@/types/company";
import { COMPANY_CREATION_COSTS } from "@/types/company";

export const useCompanies = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["companies", user?.id],
    queryFn: async (): Promise<Company[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("companies")
        .select(`
          *,
          headquarters_city:cities!headquarters_city_id(id, name, country),
          parent_company:companies!parent_company_id(id, name)
        `)
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching companies:", error);
        throw error;
      }

      return (data || []) as Company[];
    },
    enabled: !!user?.id,
  });
};

export const useCompany = (companyId: string | undefined) => {
  return useQuery({
    queryKey: ["company", companyId],
    queryFn: async (): Promise<Company | null> => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from("companies")
        .select(`
          *,
          headquarters_city:cities!headquarters_city_id(id, name, country),
          parent_company:companies!parent_company_id(id, name)
        `)
        .eq("id", companyId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching company:", error);
        throw error;
      }

      return data as Company | null;
    },
    enabled: !!companyId,
  });
};

export const useCompanySubsidiaries = (parentCompanyId: string | undefined) => {
  return useQuery({
    queryKey: ["company-subsidiaries", parentCompanyId],
    queryFn: async (): Promise<Company[]> => {
      if (!parentCompanyId) return [];

      const { data, error } = await supabase
        .from("companies")
        .select(`
          *,
          headquarters_city:cities!headquarters_city_id(id, name, country)
        `)
        .eq("parent_company_id", parentCompanyId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching subsidiaries:", error);
        throw error;
      }

      return (data || []) as Company[];
    },
    enabled: !!parentCompanyId,
  });
};

export const useCreateCompany = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCompanyInput & { profileId?: string }): Promise<Company> => {
      if (!user?.id) throw new Error("Not authenticated");

      // Get creation costs
      const costs = COMPANY_CREATION_COSTS[input.company_type];
      if (!costs) throw new Error("Invalid company type");

      // Verify player has enough funds if profileId provided
      if (input.profileId) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("cash")
          .eq("id", input.profileId)
          .single();

        if (profileError) throw profileError;
        if (Number(profile.cash) < costs.creationCost) {
          throw new Error(`Insufficient funds. Need $${costs.creationCost.toLocaleString()} to create this company.`);
        }

        // Deduct creation cost from player
        const { error: deductError } = await supabase
          .from("profiles")
          .update({ cash: Number(profile.cash) - costs.creationCost })
          .eq("id", input.profileId);

        if (deductError) throw deductError;
      }

      // Create company with starting balance
      const { data, error } = await supabase
        .from("companies")
        .insert({
          owner_id: user.id,
          name: input.name,
          company_type: input.company_type,
          description: input.description || null,
          headquarters_city_id: input.headquarters_city_id || null,
          parent_company_id: input.parent_company_id || null,
          balance: costs.startingBalance,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating company:", error);
        // If company creation failed and we deducted funds, try to refund
        if (input.profileId) {
          const { data: currentProfile } = await supabase
            .from("profiles")
            .select("cash")
            .eq("id", input.profileId)
            .single();
          
          if (currentProfile) {
            await supabase
              .from("profiles")
              .update({ cash: Number(currentProfile.cash) + costs.creationCost })
              .eq("id", input.profileId);
          }
        }
        throw error;
      }

      // Record the investment transaction
      await supabase.from("company_transactions").insert({
        company_id: data.id,
        transaction_type: "investment",
        amount: costs.startingBalance,
        description: "Initial capital investment",
      });

      return data as Company;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: "Company Created",
        description: `${data.name} has been successfully registered with $${Number(data.balance).toLocaleString()} starting capital.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create company",
        variant: "destructive",
      });
    },
  });
};

export const useUpdateCompany = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Company> & { id: string }): Promise<Company> => {
      const { data, error } = await supabase
        .from("companies")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating company:", error);
        throw error;
      }

      return data as Company;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["company", data.id] });
      toast({
        title: "Company Updated",
        description: `${data.name} has been updated.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update company",
        variant: "destructive",
      });
    },
  });
};

export const useCompanyFinancialSummary = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["company-financial-summary", user?.id],
    queryFn: async (): Promise<CompanyFinancialSummary> => {
      if (!user?.id) {
        return {
          total_balance: 0,
          monthly_income: 0,
          monthly_expenses: 0,
          monthly_net: 0,
          total_employees: 0,
          total_subsidiaries: 0,
        };
      }

      // Get all companies owned by user
      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select("id, balance, weekly_operating_costs")
        .eq("owner_id", user.id);

      if (companiesError) throw companiesError;

      const companyIds = (companies || []).map(c => c.id);
      const totalBalance = (companies || []).reduce((sum, c) => sum + Number(c.balance), 0);
      const weeklyExpenses = (companies || []).reduce((sum, c) => sum + Number(c.weekly_operating_costs), 0);

      // Get employee count
      let employeeCount = 0;
      if (companyIds.length > 0) {
        const { count, error: employeesError } = await supabase
          .from("company_employees")
          .select("id", { count: "exact", head: true })
          .in("company_id", companyIds)
          .eq("status", "active");

        if (!employeesError && count) {
          employeeCount = count;
        }
      }

      // Count subsidiaries (companies with parent_company_id set)
      const subsidiaryCount = (companies || []).filter(c => c.id).length > 1 ? companyIds.length - 1 : 0;

      // Calculate monthly estimates (4.33 weeks per month)
      const monthlyExpenses = weeklyExpenses * 4.33;

      return {
        total_balance: totalBalance,
        monthly_income: 0, // Will be calculated from transactions in Phase 9
        monthly_expenses: monthlyExpenses,
        monthly_net: -monthlyExpenses,
        total_employees: employeeCount,
        total_subsidiaries: subsidiaryCount,
      };
    },
    enabled: !!user?.id,
  });
};
