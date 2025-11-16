import { addMonths, endOfMonth, parseISO, startOfMonth } from "date-fns";

export type FinanceTransactionType = "income" | "expense" | "investment";

export interface FinanceTransaction {
  id: string;
  characterId: string;
  date: string; // ISO date string
  type: FinanceTransactionType;
  category: string;
  amount: number;
  description?: string;
  tags?: string[];
}

export interface TransactionHistoryFilters {
  startDate?: string;
  endDate?: string;
  type?: FinanceTransactionType | FinanceTransactionType[];
  limit?: number;
}

export interface InvestmentPosition {
  id: string;
  characterId: string;
  name: string;
  category: "Equity" | "Real Assets" | "Cash" | "Royalties" | "Startups";
  investedAmount: number;
  currentValue: number;
  startDate: string;
  notes?: string;
}

export interface PositionPerformance {
  position: InvestmentPosition;
  roi: number;
  annualizedRoi: number;
}

export interface PortfolioPerformanceSummary {
  totalInvested: number;
  totalCurrentValue: number;
  netGain: number;
  roi: number;
  annualizedRoi: number;
  positions: PositionPerformance[];
}

const CHARACTER_ID = "demo-character";

const MOCK_TRANSACTIONS: FinanceTransaction[] = [
  {
    id: "txn-1001",
    characterId: CHARACTER_ID,
    date: "2024-01-04",
    type: "income",
    category: "Tour Revenue",
    amount: 7200,
    description: "Winter Lights tour payout",
    tags: ["tour", "primary"],
  },
  {
    id: "txn-1002",
    characterId: CHARACTER_ID,
    date: "2024-01-06",
    type: "expense",
    category: "Travel",
    amount: 1800,
    description: "Tour bus and driver",
  },
  {
    id: "txn-1003",
    characterId: CHARACTER_ID,
    date: "2024-02-12",
    type: "income",
    category: "Merchandise",
    amount: 3100,
    description: "Album launch pop-up sales",
  },
  {
    id: "txn-1004",
    characterId: CHARACTER_ID,
    date: "2024-02-16",
    type: "expense",
    category: "Marketing",
    amount: 950,
    description: "Short-form ad campaign",
  },
  {
    id: "txn-1005",
    characterId: CHARACTER_ID,
    date: "2024-02-18",
    type: "investment",
    category: "Music ETF",
    amount: 1200,
    description: "Monthly contribution",
    tags: ["recurring"],
  },
  {
    id: "txn-1006",
    characterId: CHARACTER_ID,
    date: "2024-03-02",
    type: "income",
    category: "Sync Licensing",
    amount: 2400,
    description: "Streaming series placement",
  },
  {
    id: "txn-1007",
    characterId: CHARACTER_ID,
    date: "2024-03-06",
    type: "expense",
    category: "Studio Rental",
    amount: 1300,
    description: "Live session recording",
  },
  {
    id: "txn-1008",
    characterId: CHARACTER_ID,
    date: "2024-03-12",
    type: "expense",
    category: "Merch Production",
    amount: 750,
    description: "Spring drop inventory",
  },
  {
    id: "txn-1009",
    characterId: CHARACTER_ID,
    date: "2024-03-20",
    type: "income",
    category: "Crowdfunding",
    amount: 4100,
    description: "Backer milestone",
  },
  {
    id: "txn-1010",
    characterId: CHARACTER_ID,
    date: "2024-04-04",
    type: "expense",
    category: "Crew Payroll",
    amount: 2100,
    description: "Quarterly retainers",
  },
  {
    id: "txn-1011",
    characterId: CHARACTER_ID,
    date: "2024-04-07",
    type: "income",
    category: "Streaming",
    amount: 1850,
    description: "Q1 royalty statement",
  },
  {
    id: "txn-1012",
    characterId: CHARACTER_ID,
    date: "2024-04-14",
    type: "investment",
    category: "Studio Co-op",
    amount: 1500,
    description: "Series A contribution",
  },
  {
    id: "txn-1013",
    characterId: CHARACTER_ID,
    date: "2024-05-03",
    type: "income",
    category: "Tour Revenue",
    amount: 9600,
    description: "Spring arena support slot",
  },
  {
    id: "txn-1014",
    characterId: CHARACTER_ID,
    date: "2024-05-09",
    type: "expense",
    category: "Logistics",
    amount: 2600,
    description: "Freight and backline",
  },
  {
    id: "txn-1015",
    characterId: CHARACTER_ID,
    date: "2024-05-10",
    type: "expense",
    category: "Insurance",
    amount: 540,
    description: "Annual gear coverage",
  },
  {
    id: "txn-1016",
    characterId: CHARACTER_ID,
    date: "2024-05-22",
    type: "income",
    category: "Creator Program",
    amount: 2200,
    description: "Platform accelerator bonus",
  },
  {
    id: "txn-1017",
    characterId: CHARACTER_ID,
    date: "2024-06-02",
    type: "income",
    category: "Merchandise",
    amount: 3300,
    description: "Festival pop-up",
  },
  {
    id: "txn-1018",
    characterId: CHARACTER_ID,
    date: "2024-06-05",
    type: "expense",
    category: "Travel",
    amount: 1700,
    description: "Summer festival routing",
  },
  {
    id: "txn-1019",
    characterId: CHARACTER_ID,
    date: "2024-06-14",
    type: "investment",
    category: "Creator Syndicate",
    amount: 900,
    description: "Emerging artist fund",
  },
  {
    id: "txn-1020",
    characterId: CHARACTER_ID,
    date: "2024-06-18",
    type: "expense",
    category: "Production",
    amount: 1100,
    description: "Visual content sprint",
  },
];

const MOCK_POSITIONS: InvestmentPosition[] = [
  {
    id: "inv-3001",
    characterId: CHARACTER_ID,
    name: "Music ETF",
    category: "Equity",
    investedAmount: 8600,
    currentValue: 9450,
    startDate: "2022-08-01",
    notes: "Monthly contributions focused on live events sector.",
  },
  {
    id: "inv-3002",
    characterId: CHARACTER_ID,
    name: "Studio Co-op",
    category: "Real Assets",
    investedAmount: 12000,
    currentValue: 14500,
    startDate: "2021-05-15",
    notes: "Equity share in community studio with profit-sharing.",
  },
  {
    id: "inv-3003",
    characterId: CHARACTER_ID,
    name: "Royalty Exchange Pool",
    category: "Royalties",
    investedAmount: 5200,
    currentValue: 6100,
    startDate: "2023-02-01",
  },
  {
    id: "inv-3004",
    characterId: CHARACTER_ID,
    name: "Creator Syndicate",
    category: "Startups",
    investedAmount: 3000,
    currentValue: 4650,
    startDate: "2023-07-20",
  },
  {
    id: "inv-3005",
    characterId: CHARACTER_ID,
    name: "High-Yield Savings",
    category: "Cash",
    investedAmount: 18000,
    currentValue: 18360,
    startDate: "2023-11-01",
  },
];

const normalizeFilterType = (type?: FinanceTransactionType | FinanceTransactionType[]): FinanceTransactionType[] | undefined => {
  if (!type) {
    return undefined;
  }

  return Array.isArray(type) ? type : [type];
};

const parseDate = (value: string | undefined): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const fetchTransactionHistory = async (
  characterId: string,
  filters: TransactionHistoryFilters = {},
): Promise<FinanceTransaction[]> => {
  const allowedTypes = normalizeFilterType(filters.type);
  const start = parseDate(filters.startDate);
  const end = parseDate(filters.endDate);

  const sorted = [...MOCK_TRANSACTIONS]
    .filter((transaction) => transaction.characterId === characterId)
    .sort((a, b) => (a.date > b.date ? -1 : 1));

  const filtered = sorted.filter((transaction) => {
    if (allowedTypes && !allowedTypes.includes(transaction.type)) {
      return false;
    }

    const transactionDate = parseDate(transaction.date);

    if (start && transactionDate && transactionDate < start) {
      return false;
    }

    if (end && transactionDate && transactionDate > end) {
      return false;
    }

    return true;
  });

  if (filters.limit && filters.limit > 0) {
    return filtered.slice(0, filters.limit);
  }

  return filtered;
};

export const fetchInvestmentPositions = async (characterId: string): Promise<InvestmentPosition[]> => {
  return MOCK_POSITIONS.filter((position) => position.characterId === characterId);
};

const calculateAnnualizedReturn = (roi: number, startDate: string): number => {
  const start = parseDate(startDate);

  if (!start) {
    return roi;
  }

  const today = new Date();
  const yearsHeld = Math.max((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25), 1 / 12);

  return Math.pow(1 + roi, 1 / yearsHeld) - 1;
};

export const calculatePortfolioPerformance = (
  positions: InvestmentPosition[],
): PortfolioPerformanceSummary => {
  if (!positions.length) {
    return {
      totalInvested: 0,
      totalCurrentValue: 0,
      netGain: 0,
      roi: 0,
      annualizedRoi: 0,
      positions: [],
    };
  }

  const performance = positions.map((position) => {
    const roi = (position.currentValue - position.investedAmount) / position.investedAmount;
    const annualized = calculateAnnualizedReturn(roi, position.startDate);

    return {
      position,
      roi,
      annualizedRoi: annualized,
    } satisfies PositionPerformance;
  });

  const totals = performance.reduce(
    (acc, item) => {
      acc.totalInvested += item.position.investedAmount;
      acc.totalCurrentValue += item.position.currentValue;
      acc.weightedAnnualized += item.annualizedRoi * item.position.currentValue;
      return acc;
    },
    { totalInvested: 0, totalCurrentValue: 0, weightedAnnualized: 0 },
  );

  const netGain = totals.totalCurrentValue - totals.totalInvested;
  const roi = netGain / totals.totalInvested;
  const annualizedRoi = totals.totalCurrentValue
    ? totals.weightedAnnualized / totals.totalCurrentValue
    : 0;

  return {
    totalInvested: totals.totalInvested,
    totalCurrentValue: totals.totalCurrentValue,
    netGain,
    roi,
    annualizedRoi,
    positions: performance,
  };
};

export const fetchMonthlyLedger = async (
  characterId: string,
  months = 6,
): Promise<Array<{ month: string; income: number; expenses: number }>> => {
  const now = new Date();
  const start = startOfMonth(addMonths(now, -months + 1));
  const end = endOfMonth(now);

  const transactions = await fetchTransactionHistory(characterId, {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });

  const monthBuckets = new Map<string, { income: number; expenses: number }>();

  transactions.forEach((transaction) => {
    const date = parseISO(transaction.date);
    const bucketKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthBuckets.has(bucketKey)) {
      monthBuckets.set(bucketKey, { income: 0, expenses: 0 });
    }

    const bucket = monthBuckets.get(bucketKey)!;

    if (transaction.type === "income") {
      bucket.income += transaction.amount;
    }

    if (transaction.type === "expense") {
      bucket.expenses += transaction.amount;
    }
  });

  const monthsOrdered: { month: string; income: number; expenses: number }[] = [];

  for (let i = 0; i < months; i += 1) {
    const monthDate = addMonths(start, i);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    const bucket = monthBuckets.get(key) ?? { income: 0, expenses: 0 };
    const label = monthDate.toLocaleDateString("en-US", { month: "short" });

    monthsOrdered.push({ month: label, income: bucket.income, expenses: bucket.expenses });
  }

  return monthsOrdered;
};

