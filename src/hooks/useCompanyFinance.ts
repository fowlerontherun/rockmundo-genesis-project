import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { transferCompanyFunds } from "@/lib/api/companyFundTransfers";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/components/ui/use-toast";

const formatGBP = (amount: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);

export interface CompanyTransaction {
  id: string;
  company_id: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  category: string | null;
  created_at: string;
}

export interface CompanyTaxRecord {
  id: string;
  company_id: string;
  tax_period: string;
  gross_revenue: number;
  deductible_expenses: number;
  taxable_income: number;
  tax_rate: number;
  tax_amount: number;
  tax_type: string;
  penalty_amount: number;
  status: "pending" | "paid" | "overdue";
  due_date: string;
  paid_at: string | null;
  created_at: string;
}

export const isCompanyOperatingIncome = (transaction: CompanyTransaction) =>
  transaction.transaction_type === "income" && transaction.category !== "tax";

export const isCompanyOperatingExpense = (transaction: CompanyTransaction) =>
  ["expense", "salary"].includes(transaction.transaction_type) && transaction.category !== "tax";

export const useCompanyBalance = (companyId: string | undefined) =>
  useQuery({
    queryKey: ["company-balance", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, balance, weekly_operating_costs, is_bankrupt, negative_balance_since, company_type")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

export const useCompanyTransactions = (companyId: string | undefined, limit = 50) =>
  useQuery<CompanyTransaction[]>({
    queryKey: ["company-transactions", companyId, limit],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("company_transactions")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as CompanyTransaction[];
    },
    enabled: !!companyId,
  });

export const useCompanyIncomeExpenses = (companyId: string | undefined) =>
  useQuery({
    queryKey: ["company-income-expenses", companyId],
    queryFn: async () => {
      if (!companyId) {
        return {
          monthlyIncome: 0,
          monthlyExpenses: 0,
          dailyIncome: 0,
          dailyExpenses: 0,
          recentTransactions: [] as CompanyTransaction[],
        };
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await supabase
        .from("company_transactions")
        .select("*")
        .eq("company_id", companyId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;

      const txns = (data || []) as CompanyTransaction[];
      const monthlyIncome = txns
        .filter(isCompanyOperatingIncome)
        .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount)), 0);
      const monthlyExpenses = txns
        .filter(isCompanyOperatingExpense)
        .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount)), 0);

      return {
        monthlyIncome,
        monthlyExpenses,
        dailyIncome: monthlyIncome / 30,
        dailyExpenses: monthlyExpenses / 30,
        recentTransactions: txns,
      };
    },
    enabled: !!companyId,
  });

export const useCompanyTaxRecords = (companyId: string | undefined) =>
  useQuery<CompanyTaxRecord[]>({
    queryKey: ["company-tax-records", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("company_tax_records")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data || []) as CompanyTaxRecord[];
    },
    enabled: !!companyId,
  });

export const useAllCompanyTaxRecords = (companyIds: string[]) =>
  useQuery<CompanyTaxRecord[]>({
    queryKey: ["all-company-tax-records", companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("company_tax_records")
        .select("*")
        .in("company_id", companyIds)
        .in("status", ["pending", "overdue"])
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data || []) as CompanyTaxRecord[];
    },
    enabled: companyIds.length > 0,
  });

export const useUserCashBalance = () => {
  const { profileId } = useActiveProfile();
  return useQuery({
    queryKey: ["user-cash-balance", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase.from("profiles").select("id, cash").eq("id", profileId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });
};

const invalidateCompany = (queryClient: ReturnType<typeof useQueryClient>, companyId: string) => {
  queryClient.invalidateQueries({ queryKey: ["company-balance", companyId] });
  queryClient.invalidateQueries({ queryKey: ["company-transactions", companyId] });
  queryClient.invalidateQueries({ queryKey: ["company-income-expenses", companyId] });
  queryClient.invalidateQueries({ queryKey: ["company", companyId] });
  queryClient.invalidateQueries({ queryKey: ["company-financial-summary"] });
};

export const useDepositToCompany = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, amount }: { companyId: string; amount: number; profileId: string }) =>
      transferCompanyFunds({ transferKind: "deposit", companyId, amount }),
    onSuccess: (_, variables) => {
      invalidateCompany(queryClient, variables.companyId);
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Deposit Successful", description: `${formatGBP(variables.amount)} deposited to company.` });
    },
    onError: (error: Error) =>
      toast({ title: "Deposit Failed", description: error.message, variant: "destructive" }),
  });
};

export const useWithdrawFromCompany = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, amount }: { companyId: string; amount: number; profileId: string }) =>
      transferCompanyFunds({ transferKind: "withdrawal", companyId, amount }),
    onSuccess: (_, variables) => {
      invalidateCompany(queryClient, variables.companyId);
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Withdrawal Successful", description: `${formatGBP(variables.amount)} withdrawn from company.` });
    },
    onError: (error: Error) =>
      toast({ title: "Withdrawal Failed", description: error.message, variant: "destructive" }),
  });
};

export const useTransferBetweenCompanies = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fromCompanyId, toCompanyId, amount }: {
      fromCompanyId: string;
      toCompanyId: string;
      amount: number;
      fromName: string;
      toName: string;
    }) =>
      transferCompanyFunds({
        transferKind: "intercompany",
        companyId: fromCompanyId,
        destinationCompanyId: toCompanyId,
        amount,
      }),
    onSuccess: (_, variables) => {
      invalidateCompany(queryClient, variables.fromCompanyId);
      invalidateCompany(queryClient, variables.toCompanyId);
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast({
        title: "Transfer Successful",
        description: `${formatGBP(variables.amount)} transferred from ${variables.fromName} to ${variables.toName}.`,
      });
    },
    onError: (error: Error) =>
      toast({ title: "Transfer Failed", description: error.message, variant: "destructive" }),
  });
};

export const usePayCompanyTax = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taxRecordId }: { taxRecordId: string; companyId: string }) => {
      const { data, error } = await (supabase.rpc as any)("pay_company_tax", {
        p_tax_record_id: taxRecordId,
      });
      if (error) throw error;
      if (!data) throw new Error("company_tax_payment_empty_response");
      return data;
    },
    onSuccess: (_, variables) => {
      invalidateCompany(queryClient, variables.companyId);
      queryClient.invalidateQueries({ queryKey: ["company-tax-records", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["all-company-tax-records"] });
      toast({ title: "Tax Paid", description: "Tax payment processed successfully." });
    },
    onError: (error: Error) =>
      toast({ title: "Payment Failed", description: error.message, variant: "destructive" }),
  });
};
