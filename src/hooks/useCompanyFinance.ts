import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/components/ui/use-toast";

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
  status: 'pending' | 'paid' | 'overdue';
  due_date: string;
  paid_at: string | null;
  created_at: string;
}

export const useCompanyBalance = (companyId: string | undefined) => {
  return useQuery({
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
};

export const useCompanyTransactions = (companyId: string | undefined, limit = 50) => {
  return useQuery<CompanyTransaction[]>({
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
      return data as CompanyTransaction[];
    },
    enabled: !!companyId,
  });
};

export const useCompanyIncomeExpenses = (companyId: string | undefined) => {
  return useQuery({
    queryKey: ["company-income-expenses", companyId],
    queryFn: async () => {
      if (!companyId) return { monthlyIncome: 0, monthlyExpenses: 0, dailyIncome: 0, dailyExpenses: 0, recentTransactions: [] as CompanyTransaction[] };

      // Get transactions from last 30 days
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
      const totalIncome = txns.filter(t => t.amount > 0).reduce((sum, t) => sum + Number(t.amount), 0);
      const totalExpenses = Math.abs(txns.filter(t => t.amount < 0).reduce((sum, t) => sum + Number(t.amount), 0));

      return {
        monthlyIncome: totalIncome,
        monthlyExpenses: totalExpenses,
        dailyIncome: totalIncome / 30,
        dailyExpenses: totalExpenses / 30,
        recentTransactions: txns,
      };
    },
    enabled: !!companyId,
  });
};

export const useCompanyTaxRecords = (companyId: string | undefined) => {
  return useQuery<CompanyTaxRecord[]>({
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
      return data as CompanyTaxRecord[];
    },
    enabled: !!companyId,
  });
};

export const useAllCompanyTaxRecords = (companyIds: string[]) => {
  return useQuery<CompanyTaxRecord[]>({
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
      return data as CompanyTaxRecord[];
    },
    enabled: companyIds.length > 0,
  });
};

export const useUserCashBalance = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["user-cash-balance", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, cash")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

export const useDepositToCompany = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ companyId, amount, profileId }: { companyId: string; amount: number; profileId: string }) => {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      
      if (profileError) throw profileError;
      if (Number(profile.cash) < amount) throw new Error("Insufficient funds");
      
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({ cash: Number(profile.cash) - amount })
        .eq("id", profileId);
      
      if (updateProfileError) throw updateProfileError;
      
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("balance")
        .eq("id", companyId)
        .single();
      
      if (companyError) throw companyError;
      
      const { error: updateCompanyError } = await supabase
        .from("companies")
        .update({ 
          balance: Number(company.balance) + amount,
          negative_balance_since: null
        })
        .eq("id", companyId);
      
      if (updateCompanyError) throw updateCompanyError;
      
      const { error: transactionError } = await supabase
        .from("company_transactions")
        .insert({
          company_id: companyId,
          transaction_type: "investment",
          amount: amount,
          description: "Owner deposit",
          category: "owner_transfer",
        });
      
      if (transactionError) throw transactionError;
      
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["company-balance", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-transactions", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-income-expenses", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["company", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-financial-summary"] });
      toast({
        title: "Deposit Successful",
        description: `$${variables.amount.toLocaleString()} deposited to company.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Deposit Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useWithdrawFromCompany = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const MINIMUM_BALANCE = 10_000;
  
  return useMutation({
    mutationFn: async ({ companyId, amount, profileId }: { companyId: string; amount: number; profileId: string }) => {
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("balance")
        .eq("id", companyId)
        .single();
      
      if (companyError) throw companyError;
      
      const newBalance = Number(company.balance) - amount;
      if (newBalance < MINIMUM_BALANCE) {
        throw new Error(`Minimum balance of $${MINIMUM_BALANCE.toLocaleString()} required`);
      }
      
      const { error: updateCompanyError } = await supabase
        .from("companies")
        .update({ balance: newBalance })
        .eq("id", companyId);
      
      if (updateCompanyError) throw updateCompanyError;
      
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      
      if (profileError) throw profileError;
      
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({ cash: Number(profile.cash) + amount })
        .eq("id", profileId);
      
      if (updateProfileError) throw updateProfileError;
      
      const { error: transactionError } = await supabase
        .from("company_transactions")
        .insert({
          company_id: companyId,
          transaction_type: "dividend",
          amount: -amount,
          description: "Owner withdrawal",
          category: "owner_transfer",
        });
      
      if (transactionError) throw transactionError;
      
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["company-balance", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-transactions", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-income-expenses", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["company", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-financial-summary"] });
      toast({
        title: "Withdrawal Successful",
        description: `$${variables.amount.toLocaleString()} withdrawn from company.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const usePayCompanyTax = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ taxRecordId, companyId }: { taxRecordId: string; companyId: string }) => {
      const { data: taxRecord, error: taxError } = await supabase
        .from("company_tax_records")
        .select("tax_amount, penalty_amount, status, tax_period")
        .eq("id", taxRecordId)
        .single();
      
      if (taxError) throw taxError;
      if (taxRecord.status === 'paid') throw new Error("Tax already paid");
      
      const totalDue = Number(taxRecord.tax_amount) + (Number(taxRecord.penalty_amount) || 0);
      
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("balance")
        .eq("id", companyId)
        .single();
      
      if (companyError) throw companyError;
      
      if (Number(company.balance) < totalDue) {
        throw new Error("Insufficient company funds to pay tax");
      }
      
      const { error: updateError } = await supabase
        .from("companies")
        .update({ balance: Number(company.balance) - totalDue })
        .eq("id", companyId);
      
      if (updateError) throw updateError;
      
      const { error: taxUpdateError } = await supabase
        .from("company_tax_records")
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq("id", taxRecordId);
      
      if (taxUpdateError) throw taxUpdateError;
      
      const penaltyNote = Number(taxRecord.penalty_amount) > 0 
        ? ` + $${Number(taxRecord.penalty_amount).toFixed(0)} late penalty` 
        : '';
      
      const { error: transactionError } = await supabase
        .from("company_transactions")
        .insert({
          company_id: companyId,
          transaction_type: "expense",
          amount: -totalDue,
          description: `Corporate tax payment (${taxRecord.tax_period})${penaltyNote}`,
          category: "tax",
        });
      
      if (transactionError) throw transactionError;
      
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["company-balance", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-tax-records", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["all-company-tax-records"] });
      queryClient.invalidateQueries({ queryKey: ["company-transactions", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-financial-summary"] });
      toast({
        title: "Tax Paid",
        description: "Tax payment processed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
