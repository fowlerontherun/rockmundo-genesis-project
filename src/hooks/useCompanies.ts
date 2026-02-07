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

      // Create company with starting balance and operating costs
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
          weekly_operating_costs: costs.weeklyOperatingCosts,
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
          pending_taxes: 0,
          effective_tax_rate: 0,
        };
      }

      // Get all companies owned by user
      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select("id, balance, weekly_operating_costs, company_type")
        .eq("owner_id", user.id);

      if (companiesError) throw companiesError;

      const companyIds = (companies || []).map(c => c.id);
      const totalBalance = (companies || []).reduce((sum, c) => sum + Number(c.balance), 0);

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

      // Count subsidiaries (non-holding companies)
      const subsidiaryCount = (companies || []).filter(c => c.company_type !== 'holding').length;

      // Calculate actual monthly income & expenses from last 30 days of transactions
      let monthlyIncome = 0;
      let monthlyExpenses = 0;

      if (companyIds.length > 0) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: recentTxns } = await supabase
          .from("company_transactions")
          .select("amount")
          .in("company_id", companyIds)
          .gte("created_at", thirtyDaysAgo.toISOString());

        monthlyIncome = (recentTxns || [])
          .filter(t => Number(t.amount) > 0)
          .reduce((sum, t) => sum + Number(t.amount), 0);

        monthlyExpenses = Math.abs(
          (recentTxns || [])
            .filter(t => Number(t.amount) < 0)
            .reduce((sum, t) => sum + Number(t.amount), 0)
        );
      }

      // Get pending taxes
      let pendingTaxes = 0;
      if (companyIds.length > 0) {
        const { data: taxRecords } = await supabase
          .from("company_tax_records")
          .select("tax_amount, penalty_amount")
          .in("company_id", companyIds)
          .in("status", ["pending", "overdue"]);

        pendingTaxes = (taxRecords || []).reduce(
          (sum, t) => sum + Number(t.tax_amount) + (Number(t.penalty_amount) || 0), 0
        );
      }

      // Calculate effective tax rate
      const effectiveTaxRate = monthlyIncome > 0 
        ? pendingTaxes / monthlyIncome 
        : 0;

      return {
        total_balance: totalBalance,
        monthly_income: monthlyIncome,
        monthly_expenses: monthlyExpenses,
        monthly_net: monthlyIncome - monthlyExpenses,
        total_employees: employeeCount,
        total_subsidiaries: subsidiaryCount,
        pending_taxes: pendingTaxes,
        effective_tax_rate: effectiveTaxRate,
      };
    },
    enabled: !!user?.id,
  });
};

export const useCloseSubsidiary = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      companyId, 
      profileId,
      transferBalance = true 
    }: { 
      companyId: string; 
      profileId?: string;
      transferBalance?: boolean;
    }): Promise<void> => {
      if (!user?.id) throw new Error("Not authenticated");

      // Get company details
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("id, name, balance, company_type, parent_company_id, owner_id")
        .eq("id", companyId)
        .single();

      if (companyError || !company) throw new Error("Company not found");
      if (company.owner_id !== user.id) throw new Error("You don't own this company");
      if (company.company_type === 'holding') throw new Error("Cannot close a holding company with subsidiaries");

      // Check for active contracts/obligations
      const { count: contractCount } = await supabase
        .from("artist_label_contracts")
        .select("id", { count: "exact", head: true })
        .eq("label_id", companyId)
        .eq("status", "active");

      if (contractCount && contractCount > 0) {
        throw new Error("Cannot close company with active artist contracts");
      }

      // Transfer remaining balance to player if requested
      if (transferBalance && Number(company.balance) > 0 && profileId) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("cash")
          .eq("id", profileId)
          .single();

        if (!profileError && profile) {
          await supabase
            .from("profiles")
            .update({ cash: Number(profile.cash) + Number(company.balance) })
            .eq("id", profileId);

          // Record the withdrawal transaction
          await supabase.from("company_transactions").insert({
            company_id: companyId,
            transaction_type: "transfer_out",
            amount: Number(company.balance),
            description: "Closing liquidation - funds transferred to owner",
          });
        }
      }

      // Delete related records based on company type
      if (company.company_type === 'security') {
        await supabase.from("security_firms").delete().eq("company_id", companyId);
      } else if (company.company_type === 'factory') {
        await supabase.from("merch_factories").delete().eq("company_id", companyId);
      } else if (company.company_type === 'logistics') {
        await supabase.from("logistics_companies").delete().eq("company_id", companyId);
      }

      // Delete company settings
      await supabase.from("company_settings").delete().eq("company_id", companyId);
      
      // Delete company transactions
      await supabase.from("company_transactions").delete().eq("company_id", companyId);
      
      // Delete tax records
      await supabase.from("company_tax_records").delete().eq("company_id", companyId);

      // Finally delete the company
      const { error: deleteError } = await supabase
        .from("companies")
        .delete()
        .eq("id", companyId);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["company-subsidiaries"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      toast({
        title: "Company Closed",
        description: "The subsidiary has been successfully dissolved and any remaining funds have been transferred.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Cannot Close Company",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
