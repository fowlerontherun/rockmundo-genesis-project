import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

export interface FinancialTransaction {
  id: string;
  date: string;
  type: "income" | "expense";
  source: string;
  amount: number;
  description: string | null;
  bandName?: string;
}

export interface BandFinance {
  id: string;
  name: string;
  balance: number;
  memberCount: number;
  playerShare: number;
}

export interface PlayerLoan {
  id: string;
  loan_name: string;
  principal: number;
  interest_rate: number;
  remaining_balance: number;
  weekly_payment: number;
  total_paid: number;
  started_at: string;
  due_date: string;
  status: string;
}

export interface PlayerInvestment {
  id: string;
  investment_name: string;
  category: string;
  invested_amount: number;
  current_value: number;
  growth_rate: number;
  purchased_at: string;
  notes: string | null;
}

export interface LoanOffer {
  id: string;
  name: string;
  maxAmount: number;
  interestRate: number;
  termWeeks: number;
  description: string;
  requirements: string[];
}

export interface InvestmentOption {
  id: string;
  name: string;
  category: string;
  minInvestment: number;
  expectedReturn: string;
  risk: "Low" | "Medium" | "High";
  description: string;
}

export interface MonthlyLedgerEntry {
  month: string;
  income: number;
  expenses: number;
}

export interface FinancialSummary {
  cash: number;
  totalInvested: number;
  investmentValue: number;
  totalLoans: number;
  netWorth: number;
  totalEarnings: number;
  totalExpenses: number;
  monthlyIncome: number;
  monthlyExpenses: number;
}

// Static loan offers based on player fame/level
const LOAN_OFFERS: LoanOffer[] = [
  {
    id: "starter-loan",
    name: "Starter Equipment Loan",
    maxAmount: 5000,
    interestRate: 8.5,
    termWeeks: 24,
    description: "Perfect for upgrading your first instruments or recording gear.",
    requirements: ["No active loans", "At least 1 week in-game"],
  },
  {
    id: "tour-loan",
    name: "Tour Advance",
    maxAmount: 15000,
    interestRate: 6.5,
    termWeeks: 36,
    description: "Fund your tour expenses upfront with flexible repayment.",
    requirements: ["Band fame > 100", "Completed at least 5 gigs"],
  },
  {
    id: "studio-loan",
    name: "Studio Investment Loan",
    maxAmount: 50000,
    interestRate: 5.0,
    termWeeks: 52,
    description: "Major financing for studio time, album production, or equipment upgrades.",
    requirements: ["Band fame > 500", "Net worth > $10,000"],
  },
];

// Static investment options
const INVESTMENT_OPTIONS: InvestmentOption[] = [
  {
    id: "music-etf",
    name: "Music Industry ETF",
    category: "Equity",
    minInvestment: 500,
    expectedReturn: "4-8% annually",
    risk: "Medium",
    description: "Diversified fund tracking major music and entertainment companies.",
  },
  {
    id: "studio-coop",
    name: "Studio Co-op Share",
    category: "Real Assets",
    minInvestment: 2000,
    expectedReturn: "6-12% annually",
    risk: "Medium",
    description: "Partial ownership in a community recording studio with profit sharing.",
  },
  {
    id: "royalty-pool",
    name: "Royalty Exchange Pool",
    category: "Royalties",
    minInvestment: 1000,
    expectedReturn: "3-7% annually",
    risk: "Low",
    description: "Invest in a pool of music royalties from established artists.",
  },
  {
    id: "creator-fund",
    name: "Creator Startup Fund",
    category: "Startups",
    minInvestment: 500,
    expectedReturn: "10-25% annually",
    risk: "High",
    description: "High-risk fund investing in emerging music tech startups.",
  },
  {
    id: "savings",
    name: "High-Yield Savings",
    category: "Cash",
    minInvestment: 100,
    expectedReturn: "2-3% annually",
    risk: "Low",
    description: "Safe, liquid savings with modest but guaranteed returns.",
  },
];

export const useFinances = () => {
  const { user } = useAuth();

  // Fetch player's cash from profiles
  const { data: profile } = useQuery({
    queryKey: ["profile-cash", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("cash, fame")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch player's bands and their balances
  const { data: bands } = useQuery({
    queryKey: ["player-bands-finances", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: memberships, error: memberError } = await supabase
        .from("band_members")
        .select("band_id, bands!band_members_band_id_fkey(id, name, band_balance)")
        .eq("user_id", user.id);
      
      if (memberError) throw memberError;

      const bandFinances: BandFinance[] = [];
      for (const m of memberships || []) {
        const band = m.bands as unknown as { id: string; name: string; band_balance: number };
        if (!band) continue;
        
        // Get member count for share calculation
        const { count } = await supabase
          .from("band_members")
          .select("*", { count: "exact", head: true })
          .eq("band_id", band.id);
        
        const memberCount = count || 1;
        bandFinances.push({
          id: band.id,
          name: band.name,
          balance: band.band_balance || 0,
          memberCount,
          playerShare: (band.band_balance || 0) / memberCount,
        });
      }
      return bandFinances;
    },
    enabled: !!user?.id,
  });

  // Fetch transaction history from band_earnings
  const { data: transactions } = useQuery({
    queryKey: ["finance-transactions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Get earnings attributed to user
      const { data: earnings, error: earningsError } = await supabase
        .from("band_earnings")
        .select("id, created_at, source, amount, description, band_id, bands(name)")
        .eq("earned_by_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (earningsError) throw earningsError;

      const txns: FinancialTransaction[] = (earnings || []).map((e) => ({
        id: e.id,
        date: e.created_at,
        type: e.amount >= 0 ? "income" : "expense",
        source: e.source,
        amount: Math.abs(e.amount),
        description: e.description,
        bandName: (e.bands as unknown as { name: string })?.name,
      }));

      return txns;
    },
    enabled: !!user?.id,
  });

  // Fetch player investments
  const { data: investments } = useQuery({
    queryKey: ["player-investments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("player_investments")
        .select("*")
        .eq("user_id", user.id)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data as PlayerInvestment[];
    },
    enabled: !!user?.id,
  });

  // Fetch player loans
  const { data: loans } = useQuery({
    queryKey: ["player-loans", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("player_loans")
        .select("*")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data as PlayerLoan[];
    },
    enabled: !!user?.id,
  });

  // Calculate monthly ledger from transactions
  const monthlyLedger: MonthlyLedgerEntry[] = (() => {
    if (!transactions?.length) return [];
    
    const now = new Date();
    const months: MonthlyLedgerEntry[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthDate.toLocaleDateString("en-US", { month: "short" });
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      
      const monthTxns = transactions.filter((t) => {
        const d = new Date(t.date);
        return d >= monthStart && d <= monthEnd;
      });
      
      const income = monthTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expenses = monthTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      
      months.push({ month: monthKey, income, expenses });
    }
    
    return months;
  })();

  // Calculate summary
  const summary: FinancialSummary = (() => {
    const cash = profile?.cash || 0;
    const totalInvested = investments?.reduce((s, i) => s + i.invested_amount, 0) || 0;
    const investmentValue = investments?.reduce((s, i) => s + i.current_value, 0) || 0;
    const activeLoans = loans?.filter((l) => l.status === "active") || [];
    const totalLoans = activeLoans.reduce((s, l) => s + l.remaining_balance, 0);
    const bandEquity = bands?.reduce((s, b) => s + b.playerShare, 0) || 0;
    
    const totalEarnings = transactions?.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0) || 0;
    const totalExpenses = transactions?.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0) || 0;
    
    // Monthly averages from ledger
    const monthlyIncome = monthlyLedger.length 
      ? monthlyLedger.reduce((s, m) => s + m.income, 0) / monthlyLedger.length 
      : 0;
    const monthlyExpenses = monthlyLedger.length 
      ? monthlyLedger.reduce((s, m) => s + m.expenses, 0) / monthlyLedger.length 
      : 0;

    return {
      cash,
      totalInvested,
      investmentValue,
      totalLoans,
      netWorth: cash + investmentValue + bandEquity - totalLoans,
      totalEarnings,
      totalExpenses,
      monthlyIncome,
      monthlyExpenses,
    };
  })();

  // Calculate earnings by source
  const earningsBySource: Record<string, number> = (() => {
    if (!transactions?.length) return {};
    const bySource: Record<string, number> = {};
    transactions.filter((t) => t.type === "income").forEach((t) => {
      bySource[t.source] = (bySource[t.source] || 0) + t.amount;
    });
    return bySource;
  })();

  return {
    profile,
    bands: bands || [],
    transactions: transactions || [],
    investments: investments || [],
    loans: loans || [],
    monthlyLedger,
    summary,
    earningsBySource,
    loanOffers: LOAN_OFFERS,
    investmentOptions: INVESTMENT_OPTIONS,
    isLoading: !profile,
  };
};
