import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/components/ui/use-toast";
import type { Company, CreateCompanyInput, CompanyFinancialSummary } from "@/types/company";
import { COMPANY_CREATION_COSTS } from "@/types/company";
import { foundCompany } from "@/lib/api/companyFounding";
import { closeCompany } from "@/lib/api/companyClosure";
import { loadCompanyTransactionsSince, isCompanyOperatingIncome, isCompanyOperatingExpense } from "@/hooks/useCompanyFinance";

export const useCompanies = () => {
  const { userId } = useActiveProfile();

  return useQuery({
    queryKey: ["companies", userId],
    queryFn: async (): Promise<Company[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("companies")
        .select(`
          *,
          headquarters_city:cities!headquarters_city_id(id, name, country),
          parent_company:companies!parent_company_id(id, name)
        `)
        .eq("owner_id", userId)
        .neq("status", "dissolved")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching companies:", error);
        throw error;
      }

      const companies = (data || []) as unknown as Company[];
      if (companies.length === 0) return companies;

      const { data: festivalCompanies, error: festivalError } = await (supabase as any)
        .from("festival_companies")
        .select("id, company_id")
        .in("company_id", companies.map((company) => company.id));

      if (festivalError) {
        console.error("Error fetching festival company extensions:", festivalError);
      }

      const festivalIdByCompany = new Map<string, string>(
        (festivalCompanies || []).map((festival: { company_id: string; id: string }) => [festival.company_id, festival.id] as [string, string]),
      );

      return companies.map((company) => ({
        ...company,
        festival_company_id: festivalIdByCompany.get(company.id) ?? null,
      })) as Company[];
    },
    enabled: !!userId,
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

      if (!data) return null;

      const { data: festivalCompany, error: festivalError } = await (supabase as any)
        .from("festival_companies")
        .select("id")
        .eq("company_id", data.id)
        .maybeSingle();

      if (festivalError) {
        console.error("Error fetching festival company extension:", festivalError);
      }

      return {
        ...(data as unknown as Company),
        festival_company_id: (festivalCompany as { id?: string } | null)?.id ?? null,
      };
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
        .neq("status", "dissolved")
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
  const { userId } = useActiveProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCompanyInput & { profileId?: string }): Promise<Company> => {
      if (!userId) throw new Error("Not authenticated");
      if (input.company_type === "festival") {
        throw new Error("Festival companies must be founded through the secure VIP festival RPC.");
      }
      const result = await foundCompany({ ...input, company_type: input.company_type });
      const { data, error } = await supabase.from("companies").select("*").eq("id", result.companyId).single();
      if (error) throw error;
      return data as Company;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["company-financial-summary"] });
      toast({
        title: "Company Created",
        description: `${data.name} has been registered with £${Number(data.balance).toLocaleString()} owner-funded starting capital.`,
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
    mutationFn: async ({ id, ...updates }: Pick<Company, "id"> & Partial<Pick<Company, "name" | "description" | "logo_url">>): Promise<Company> => {
      const { data, error } = await supabase
        .from("companies")
        .update(updates as any)
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
  const { userId } = useActiveProfile();

  return useQuery({
    queryKey: ["company-financial-summary", userId],
    queryFn: async (): Promise<CompanyFinancialSummary> => {
      if (!userId) {
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

      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select("id, balance, weekly_operating_costs, company_type, parent_company_id")
        .eq("owner_id", userId)
        .neq("status", "dissolved");

      if (companiesError) throw companiesError;

      const companyIds = (companies || []).map(c => c.id);
      const totalBalance = (companies || []).reduce((sum, c) => sum + Number(c.balance), 0);

      let employeeCount = 0;
      if (companyIds.length > 0) {
        const { data: workforce, error: workforceError } = await (supabase as any)
          .rpc("get_company_workforce_counts", { _owner_id: userId });

        if (!workforceError && Array.isArray(workforce)) {
          employeeCount = workforce.reduce(
            (sum: number, row: { employee_count: number | string }) =>
              sum + Number(row.employee_count ?? 0),
            0,
          );
        }
      }

      const subsidiaryCount = (companies || []).filter(c => c.parent_company_id !== null).length;

      let monthlyIncome = 0;
      let monthlyExpenses = 0;

      if (companyIds.length > 0) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentTxns = await loadCompanyTransactionsSince(companyIds, thirtyDaysAgo.toISOString());
        monthlyIncome = recentTxns.filter(isCompanyOperatingIncome)
          .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
        monthlyExpenses = recentTxns.filter(isCompanyOperatingExpense)
          .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
      }

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

      const effectiveTaxRate = monthlyIncome - monthlyExpenses > 0
        ? pendingTaxes / (monthlyIncome - monthlyExpenses)
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
    enabled: !!userId,
  });
};

export const useCloseSubsidiary = () => {
  const { userId } = useActiveProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      transferBalance = true
    }: {
      companyId: string;
      profileId?: string;
      transferBalance?: boolean;
    }): Promise<void> => {
      if (!userId) throw new Error("Not authenticated");

      await closeCompany(companyId, transferBalance);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["company-subsidiaries"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["company-financial-summary"] });
      toast({
        title: "Company Closed",
        description: "The subsidiary has been dissolved. Eligible funds were settled through the finance ledger.",
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
