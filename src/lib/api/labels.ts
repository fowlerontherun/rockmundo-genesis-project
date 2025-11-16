import { format } from "date-fns";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase-client";
import type { Tables } from "@/lib/supabase-types";

export type LabelRecord = Tables<"labels">;
export type ContractRecord = Tables<"artist_label_contracts">;
export type ReleaseRecord = Tables<"label_releases">;

export interface ContractRevenueReport {
  id: string;
  status: string | null;
  artistName: string;
  entityType: "band" | "solo" | "unassigned";
  lifetimeGrossRevenue: number;
  lifetimeArtistPayout: number;
  lifetimeLabelProfit: number;
  advanceAmount: number;
  recoupedAmount: number;
  recoupmentOutstanding: number;
  lastStatementAt: string | null;
}

export interface ReleaseRevenueReport {
  id: string;
  title: string;
  status: string | null;
  releaseDate: string | null;
  contractId: string;
  contractName: string;
  streamingRevenue: number;
  digitalRevenue: number;
  physicalRevenue: number;
  syncRevenue: number;
  otherRevenue: number;
  totalRevenue: number;
  expenseTotal: number;
  netRevenue: number;
}

export interface LabelRevenueTimelinePoint {
  month: string;
  monthKey: string;
  totalRevenue: number;
  streamingRevenue: number;
  digitalRevenue: number;
  physicalRevenue: number;
  syncRevenue: number;
  otherRevenue: number;
}

export interface ChannelBreakdownEntry {
  channel: string;
  value: number;
}

export interface LabelRevenueTotals {
  totalRevenue: number;
  streamingRevenue: number;
  digitalRevenue: number;
  physicalRevenue: number;
  syncRevenue: number;
  otherRevenue: number;
  expenseTotal: number;
  netRevenue: number;
}

export interface ContractTotalsSummary {
  lifetimeGrossRevenue: number;
  lifetimeArtistPayout: number;
  lifetimeLabelProfit: number;
}

export interface LabelRevenueDashboard {
  label: LabelRecord;
  totals: LabelRevenueTotals;
  channelBreakdown: ChannelBreakdownEntry[];
  timeline: LabelRevenueTimelinePoint[];
  releases: ReleaseRevenueReport[];
  contracts: ContractRevenueReport[];
  contractTotals: ContractTotalsSummary;
  stats: {
    contractCount: number;
    activeContractCount: number;
    releaseCount: number;
  };
}

interface ContractQueryRow extends ContractRecord {
  bands?: { id: string; name: string | null } | null;
  profiles?: { id: string; display_name: string | null } | null;
}

const numberOrZero = (value: unknown): number => {
  const numericValue = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const resolveContractArtistName = (contract: ContractQueryRow): { name: string; type: ContractRevenueReport["entityType"] } => {
  if (contract.bands?.name) {
    return { name: contract.bands.name, type: "band" };
  }

  if (contract.profiles?.display_name) {
    return { name: contract.profiles.display_name, type: "solo" };
  }

  return { name: "Unassigned artist", type: "unassigned" };
};

const buildContractReport = (contract: ContractQueryRow): ContractRevenueReport => {
  const { name, type } = resolveContractArtistName(contract);
  const advanceAmount = numberOrZero(contract.advance_amount);
  const recoupedAmount = numberOrZero(contract.recouped_amount);
  const lifetimeGrossRevenue = numberOrZero(contract.lifetime_gross_revenue);
  const lifetimeArtistPayout = numberOrZero(contract.lifetime_artist_payout);
  const lifetimeLabelProfit = numberOrZero(contract.lifetime_label_profit);

  return {
    id: contract.id,
    status: contract.status ?? null,
    artistName: name,
    entityType: type,
    lifetimeGrossRevenue,
    lifetimeArtistPayout,
    lifetimeLabelProfit,
    advanceAmount,
    recoupedAmount,
    recoupmentOutstanding: Math.max(0, advanceAmount - recoupedAmount),
    lastStatementAt: contract.last_statement_at ?? null,
  };
};

const buildReleaseReport = (
  release: ReleaseRecord,
  contractDisplayName: string,
): ReleaseRevenueReport => {
  const streamingRevenue = numberOrZero(release.streaming_revenue);
  const digitalRevenue = numberOrZero(release.digital_revenue);
  const physicalRevenue = numberOrZero(release.physical_revenue);
  const syncRevenue = numberOrZero(release.sync_revenue);
  let otherRevenue = numberOrZero(release.other_revenue);
  const grossRevenue = numberOrZero(release.gross_revenue);

  let totalRevenue = streamingRevenue + digitalRevenue + physicalRevenue + syncRevenue + otherRevenue;

  if (totalRevenue <= 0 && grossRevenue > 0) {
    otherRevenue += grossRevenue;
    totalRevenue = grossRevenue;
  }

  const expenseTotal = numberOrZero(release.promotion_budget) + numberOrZero(release.masters_cost);

  return {
    id: release.id,
    title: release.title,
    status: release.status ?? null,
    releaseDate: release.release_date ?? release.scheduled_date ?? null,
    contractId: release.contract_id,
    contractName: contractDisplayName,
    streamingRevenue,
    digitalRevenue,
    physicalRevenue,
    syncRevenue,
    otherRevenue,
    totalRevenue,
    expenseTotal,
    netRevenue: totalRevenue - expenseTotal,
  };
};

export const fetchLabelRevenueDashboard = async (
  labelId: string,
): Promise<LabelRevenueDashboard> => {
  const { data: label, error: labelError } = await supabase
    .from("labels")
    .select("*")
    .eq("id", labelId)
    .maybeSingle();

  if (labelError) {
    throw labelError;
  }

  if (!label) {
    throw new Error("Label not found");
  }

  const { data: contractRows, error: contractError } = await supabase
    .from("artist_label_contracts")
    .select(
      `*,
      bands:bands (id, name),
      profiles:profiles!artist_label_contracts_artist_profile_id_fkey (id, display_name)
    `,
    )
    .eq("label_id", labelId);

  if (contractError) {
    throw contractError;
  }

  const contracts: ContractQueryRow[] = (contractRows ?? []) as ContractQueryRow[];
  const contractReports = contracts.map(buildContractReport);
  const contractIdSet = contracts.map((contract) => contract.id);

  const contractNameMap = new Map<string, string>();
  contracts.forEach((contract) => {
    const { name } = resolveContractArtistName(contract);
    contractNameMap.set(contract.id, name);
  });

  let releases: ReleaseRecord[] = [];
  if (contractIdSet.length > 0) {
    const { data: releaseRows, error: releaseError } = await supabase
      .from("label_releases")
      .select("*")
      .in("contract_id", contractIdSet);

    if (releaseError) {
      throw releaseError;
    }

    releases = (releaseRows ?? []) as ReleaseRecord[];
  }

  const releaseReports = releases.map((release) =>
    buildReleaseReport(release, contractNameMap.get(release.contract_id) ?? "Unassigned contract"),
  );

  const totals = releaseReports.reduce<LabelRevenueTotals>(
    (acc, report) => {
      acc.streamingRevenue += report.streamingRevenue;
      acc.digitalRevenue += report.digitalRevenue;
      acc.physicalRevenue += report.physicalRevenue;
      acc.syncRevenue += report.syncRevenue;
      acc.otherRevenue += report.otherRevenue;
      acc.totalRevenue += report.totalRevenue;
      acc.expenseTotal += report.expenseTotal;
      acc.netRevenue += report.netRevenue;
      return acc;
    },
    {
      streamingRevenue: 0,
      digitalRevenue: 0,
      physicalRevenue: 0,
      syncRevenue: 0,
      otherRevenue: 0,
      totalRevenue: 0,
      expenseTotal: 0,
      netRevenue: 0,
    },
  );

  const monthMap = new Map<string, LabelRevenueTimelinePoint>();

  releaseReports.forEach((report) => {
    if (!report.releaseDate) {
      return;
    }

    const parsed = new Date(report.releaseDate);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }

    const monthKey = format(parsed, "yyyy-MM");
    const monthLabel = format(parsed, "MMM yyyy");

    const point = monthMap.get(monthKey) ?? {
      monthKey,
      month: monthLabel,
      totalRevenue: 0,
      streamingRevenue: 0,
      digitalRevenue: 0,
      physicalRevenue: 0,
      syncRevenue: 0,
      otherRevenue: 0,
    };

    point.totalRevenue += report.totalRevenue;
    point.streamingRevenue += report.streamingRevenue;
    point.digitalRevenue += report.digitalRevenue;
    point.physicalRevenue += report.physicalRevenue;
    point.syncRevenue += report.syncRevenue;
    point.otherRevenue += report.otherRevenue;

    monthMap.set(monthKey, point);
  });

  const timeline = Array.from(monthMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const channelBreakdown: ChannelBreakdownEntry[] = [
    { channel: "Streaming", value: totals.streamingRevenue },
    { channel: "Digital", value: totals.digitalRevenue },
    { channel: "Physical", value: totals.physicalRevenue },
    { channel: "Licensing & Sync", value: totals.syncRevenue },
    { channel: "Other", value: totals.otherRevenue },
  ];

  const contractTotals = contractReports.reduce<ContractTotalsSummary>(
    (acc, contract) => {
      acc.lifetimeGrossRevenue += contract.lifetimeGrossRevenue;
      acc.lifetimeArtistPayout += contract.lifetimeArtistPayout;
      acc.lifetimeLabelProfit += contract.lifetimeLabelProfit;
      return acc;
    },
    {
      lifetimeGrossRevenue: 0,
      lifetimeArtistPayout: 0,
      lifetimeLabelProfit: 0,
    },
  );

  const activeContractCount = contractReports.filter((contract) => {
    const status = contract.status?.toLowerCase();
    return status !== "terminated" && status !== "expired";
  }).length;

  return {
    label: label as LabelRecord,
    totals,
    channelBreakdown,
    timeline,
    releases: releaseReports,
    contracts: contractReports,
    contractTotals,
    stats: {
      contractCount: contractReports.length,
      activeContractCount,
      releaseCount: releaseReports.length,
    },
  };
};
