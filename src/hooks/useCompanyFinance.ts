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
        .select("id, name, balance, weekly_operating_costs, is_bankrupt, negative_balance_since")
        .eq("id", companyId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
};

export const useCompanyTransactions = (companyId: string | undefined) => {
  return useQuery<CompanyTransaction[]>({
    queryKey: ["company-transactions", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("company_transactions")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as CompanyTransaction[];
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
      // Start transaction: Deduct from player, add to company
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      
      if (profileError) throw profileError;
      if (Number(profile.cash) < amount) throw new Error("Insufficient funds");
      
      // Update profile cash
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({ cash: Number(profile.cash) - amount })
        .eq("id", profileId);
      
      if (updateProfileError) throw updateProfileError;
      
      // Update company balance
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
          negative_balance_since: null // Clear negative status if depositing
        })
        .eq("id", companyId);
      
      if (updateCompanyError) throw updateCompanyError;
      
      // Record transaction
      const { error: transactionError } = await supabase
        .from("company_transactions")
        .insert({
          company_id: companyId,
          transaction_type: "investment",
          amount: amount,
          description: "Owner deposit",
        });
      
      if (transactionError) throw transactionError;
      
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["company-balance", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-transactions", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["company", variables.companyId] });
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
  const MINIMUM_BALANCE = 10_000; // $10k minimum balance after withdrawal
  
  return useMutation({
    mutationFn: async ({ companyId, amount, profileId }: { companyId: string; amount: number; profileId: string }) => {
      // Get company balance
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
      
      // Update company balance
      const { error: updateCompanyError } = await supabase
        .from("companies")
        .update({ balance: newBalance })
        .eq("id", companyId);
      
      if (updateCompanyError) throw updateCompanyError;
      
      // Update profile cash
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
      
      // Record transaction
      const { error: transactionError } = await supabase
        .from("company_transactions")
        .insert({
          company_id: companyId,
          transaction_type: "dividend",
          amount: -amount,
          description: "Owner withdrawal",
        });
      
      if (transactionError) throw transactionError;
      
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["company-balance", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-transactions", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["user-cash-balance"] });
      queryClient.invalidateQueries({ queryKey: ["company", variables.companyId] });
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
      // Get tax record
      const { data: taxRecord, error: taxError } = await supabase
        .from("company_tax_records")
        .select("tax_amount, status")
        .eq("id", taxRecordId)
        .single();
      
      if (taxError) throw taxError;
      if (taxRecord.status === 'paid') throw new Error("Tax already paid");
      
      // Get company balance
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("balance")
        .eq("id", companyId)
        .single();
      
      if (companyError) throw companyError;
      
      const taxAmount = Number(taxRecord.tax_amount);
      if (Number(company.balance) < taxAmount) {
        throw new Error("Insufficient company funds to pay tax");
      }
      
      // Deduct from company
      const { error: updateError } = await supabase
        .from("companies")
        .update({ balance: Number(company.balance) - taxAmount })
        .eq("id", companyId);
      
      if (updateError) throw updateError;
      
      // Mark tax as paid
      const { error: taxUpdateError } = await supabase
        .from("company_tax_records")
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq("id", taxRecordId);
      
      if (taxUpdateError) throw taxUpdateError;
      
      // Record transaction
      const { error: transactionError } = await supabase
        .from("company_transactions")
        .insert({
          company_id: companyId,
          transaction_type: "expense",
          amount: -taxAmount,
          description: "Tax payment",
        });
      
      if (transactionError) throw transactionError;
      
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["company-balance", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-tax-records", variables.companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-transactions", variables.companyId] });
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
