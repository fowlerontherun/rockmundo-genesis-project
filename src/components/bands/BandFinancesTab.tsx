import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import {
  DollarSign,
  TrendingUp,
  PiggyBank,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Music,
  Mic,
  ShoppingBag,
  Radio,
  Settings,
  Users,
  Calendar,
  HandCoins,
} from "lucide-react";

interface BandFinancesTabProps {
  bandId: string;
}

type BandRow = Database["public"]["Tables"]["bands"]["Row"];
type BandEarningRow = Database["public"]["Tables"]["band_earnings"]["Row"];

const sourceLabels: Record<string, string> = {
  gig: "Gig payout",
  rehearsal: "Rehearsal expense",
  merch: "Merchandise",
  streaming: "Streaming revenue",
  release: "Release investment",
  release_sales: "Record sales",
  video_revenue: "Video revenue",
  sponsorship: "Sponsorship deal",
  pr_appearance: "PR appearance",
  refund: "Refund",
  leader_deposit: "Leader deposit",
  leader_withdrawal: "Leader withdrawal",
  recording: "Recording session",
  major_event: "Major event performance",
  weekly_pay: "Weekly member pay",
};

const sourceIcons: Record<string, React.ReactNode> = {
  gig: <Mic className="h-3.5 w-3.5" />,
  streaming: <Radio className="h-3.5 w-3.5" />,
  release_sales: <Music className="h-3.5 w-3.5" />,
  merch: <ShoppingBag className="h-3.5 w-3.5" />,
  rehearsal: <Calendar className="h-3.5 w-3.5" />,
  recording: <Music className="h-3.5 w-3.5" />,
  weekly_pay: <Users className="h-3.5 w-3.5" />,
};

function getSourceLabel(source: string) {
  return (
    sourceLabels[source] ??
    source
      .split("_")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ")
  );
}

function formatCurrency(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

interface EligibleContributionAccount {
  id: string;
  displayName: string;
  providerName: string;
  accountType: string;
  maskedAccountNumber: string;
  currencyCode: string;
  currentBalanceMinor: number;
  availableBalanceMinor: number;
  isPrimary: boolean;
  eligible: boolean;
  ineligibleReason: string | null;
}

interface EligibleAccountsResponse {
  status:
    | "ok"
    | "profile_missing"
    | "not_band_member"
    | "no_personal_accounts"
    | "no_eligible_accounts"
    | "currency_mismatch";
  accounts: EligibleContributionAccount[];
  message?: string | null;
}

interface ContributionResult {
  contributionId?: string;
  transactionId?: string;
  newPlayerAvailableBalance?: number;
  newBandTreasuryBalance?: number;
}

interface TreasuryAccount {
  accountId: string;
  currencyCode: string;
  currentBalanceMinor: number;
  reservedBalanceMinor?: number;
  availableBalanceMinor: number;
  isPrimary: boolean;
}

interface DashboardContribution {
  id: string;
  amountMinor: number;
  currencyCode: string;
  contributionType: string;
  refundableStatus: string;
  notes: string | null;
  createdAt: string;
  contributorDisplayName: string;
  contributorAvatarUrl: string | null;
}

interface TreasuryDashboard {
  status?:
    | "ok"
    | "treasury_missing"
    | "profile_missing"
    | "permission_denied"
    | "band_missing";
  primaryCurrencyCode: string;
  treasuries: TreasuryAccount[];
  contributions: DashboardContribution[];
}

interface ContributionPreview {
  sourceAccountDisplay: string;
  currencyCode: string;
  currentPersonalBalanceMinor: number;
  amountMinor: number;
  resultingPersonalBalanceMinor: number;
  destinationTreasuryName: string;
  currentTreasuryBalanceMinor: number;
  resultingTreasuryBalanceMinor: number;
  eligible: boolean;
  ineligibleReason: string | null;
  warningText: string;
}

interface SupabaseFinanceRpcClient {
  rpc(
    fn: "get_my_eligible_band_contribution_accounts",
    args: { p_band_id: string; p_currency_code: string | null },
  ): Promise<{
    data: EligibleAccountsResponse | null;
    error: { message: string } | null;
  }>;
  rpc(
    fn: "get_band_treasury_dashboard",
    args: { p_band_id: string },
  ): Promise<{
    data: TreasuryDashboard | null;
    error: { message: string } | null;
  }>;
  rpc(
    fn: "preview_my_band_contribution",
    args: {
      p_band_id: string;
      p_bank_account_id: string;
      p_amount_minor: number;
    },
  ): Promise<{
    data: ContributionPreview | null;
    error: { message: string } | null;
  }>;
  rpc(
    fn: "contribute_my_personal_funds_to_band",
    args: {
      p_band_id: string;
      p_bank_account_id: string;
      p_amount_minor: number;
      p_note: string | null;
      p_idempotency_key: string;
    },
  ): Promise<{
    data: ContributionResult | null;
    error: { message: string } | null;
  }>;
}

const financeRpc = supabase as unknown as SupabaseFinanceRpcClient;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

function formatDateTime(value: string) {
  try {
    return format(new Date(value), "MMM d, yyyy h:mm a");
  } catch {
    return value;
  }
}

export function BandFinancesTab({ bandId }: BandFinancesTabProps) {
  const { toast } = useToast();
  const { profileId } = useActiveProfile();
  const [loading, setLoading] = useState(true);
  const [band, setBand] = useState<BandRow | null>(null);
  const [earnings, setEarnings] = useState<BandEarningRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [weeklyPayPct, setWeeklyPayPct] = useState(0);
  const [savingPay, setSavingPay] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [personalAccounts, setPersonalAccounts] = useState<
    EligibleContributionAccount[]
  >([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<
    EligibleAccountsResponse["status"] | null
  >(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionNote, setContributionNote] = useState("");
  const [contributing, setContributing] = useState(false);
  const [previewingContribution, setPreviewingContribution] = useState(false);
  const [contributionPreview, setContributionPreview] =
    useState<ContributionPreview | null>(null);
  const [contributionIdempotencyKey, setContributionIdempotencyKey] = useState<
    string | null
  >(null);
  const [dashboard, setDashboard] = useState<TreasuryDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [contributions, setContributions] = useState<DashboardContribution[]>(
    [],
  );
  const treasuryRequestId = useRef(0);
  const accountsRequestId = useRef(0);

  const fetchEligibleAccounts = async () => {
    const requestId = ++accountsRequestId.current;
    if (!bandId || !profileId) {
      if (requestId === accountsRequestId.current) {
        setPersonalAccounts([]);
        setSelectedAccountId("");
        setAccountStatus(profileId ? null : "profile_missing");
      }
      return;
    }

    setAccountsLoading(true);
    setAccountError(null);
    const { data, error } = await financeRpc.rpc(
      "get_my_eligible_band_contribution_accounts",
      {
        p_band_id: bandId,
        p_currency_code:
          dashboard?.primaryCurrencyCode ?? (band ? "GBP" : null),
      },
    );
    if (requestId !== accountsRequestId.current) return;
    setAccountsLoading(false);

    if (error) {
      setPersonalAccounts([]);
      setSelectedAccountId("");
      setAccountStatus(null);
      setAccountError(getErrorMessage(error, "Unable to load accounts."));
      return;
    }

    const accounts = data?.accounts ?? [];
    setPersonalAccounts(accounts);
    setAccountStatus(data?.status ?? "no_eligible_accounts");
    setSelectedAccountId((current) => {
      if (current && accounts.some((account) => account.id === current))
        return current;
      return (
        accounts.find((account) => account.isPrimary)?.id ??
        accounts[0]?.id ??
        ""
      );
    });
  };

  const fetchTreasuryDashboard = async () => {
    const requestId = ++treasuryRequestId.current;
    if (!bandId || !profileId) return;
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const { data, error } = await financeRpc.rpc(
        "get_band_treasury_dashboard",
        {
          p_band_id: bandId,
        },
      );
      if (error) throw error;
      if (requestId !== treasuryRequestId.current) return;
      setDashboard(data);
      setContributions(data?.contributions ?? []);
    } catch (caught) {
      if (requestId !== treasuryRequestId.current) return;
      const message = getErrorMessage(
        caught,
        "Unable to load treasury dashboard.",
      );
      console.error("Failed to load band treasury dashboard", caught);
      setDashboard(null);
      setContributions([]);
      setDashboardError(message);
    } finally {
      if (requestId === treasuryRequestId.current) setDashboardLoading(false);
    }
  };

  const fetchFinances = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        { data: bandData, error: bandError },
        { data: earningData, error: earningError },
        { data: membersData, error: membersError },
      ] = await Promise.all([
        supabase.from("bands").select("*").eq("id", bandId).single(),
        supabase
          .from("band_earnings")
          .select("*")
          .eq("band_id", bandId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("band_members")
          .select("id, is_touring_member, user_id")
          .eq("band_id", bandId),
      ]);

      if (bandError) throw bandError;
      if (earningError) throw earningError;
      if (membersError) throw membersError;

      const b = bandData as BandRow;
      setBand(b);
      setEarnings((earningData as BandEarningRow[]) ?? []);
      setWeeklyPayPct(Number(b.weekly_pay_percent ?? 0));
      setIsLeader(!!profileId && profileId === b.leader_id);
      const realMembers = (membersData ?? []).filter(
        (m) => !m.is_touring_member,
      );
      setMemberCount(realMembers.length);
      void fetchTreasuryDashboard();
    } catch (caught) {
      console.error("Failed to load band finances", caught);
      setBand(null);
      setEarnings([]);
      setError("We were unable to load the financial data for this band.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    treasuryRequestId.current += 1;
    accountsRequestId.current += 1;
    setDashboard(null);
    setDashboardError(null);
    setContributions([]);
    setPersonalAccounts([]);
    setSelectedAccountId("");
    setContributionPreview(null);
    setContributionIdempotencyKey(null);
    void fetchFinances();
  }, [bandId, profileId]);

  useEffect(() => {
    void fetchEligibleAccounts();
  }, [bandId, profileId, dashboard?.primaryCurrencyCode, band?.id]);

  const primaryTreasury =
    dashboard?.treasuries.find(
      (treasury) => treasury.currencyCode === dashboard.primaryCurrencyCode,
    ) ??
    dashboard?.treasuries.find((treasury) => treasury.isPrimary) ??
    dashboard?.treasuries[0];
  const dashboardStatus = dashboard?.status ?? null;
  const canUseLegacyFallback =
    !primaryTreasury &&
    !!band &&
    (dashboardStatus === "treasury_missing" ||
      (!!dashboardError && dashboardStatus !== "permission_denied"));
  const balanceSource = primaryTreasury
    ? "ledger"
    : canUseLegacyFallback
      ? "legacy_fallback"
      : "unavailable";
  const treasuryCurrency =
    primaryTreasury?.currencyCode ?? dashboard?.primaryCurrencyCode ?? "GBP";

  const aggregated = useMemo(() => {
    const balance =
      primaryTreasury?.availableBalanceMinor !== undefined
        ? primaryTreasury.availableBalanceMinor / 100
        : canUseLegacyFallback
          ? Number(band?.band_balance ?? 0)
          : 0;
    if (earnings.length === 0) {
      return {
        balance,
        totalIncome: 0,
        totalExpenses: 0,
        averageDeposit: 0,
        monthlyRunway: 0,
        recentActivity: [],
        bySource: {} as Record<string, number>,
      };
    }

    const deposits = earnings.filter((e) => e.amount > 0);
    const expenses = earnings.filter((e) => e.amount < 0);

    const totalIncome = deposits.reduce((s, e) => s + e.amount, 0);
    const totalExpenses = Math.abs(expenses.reduce((s, e) => s + e.amount, 0));

    const averageDeposit = deposits.length
      ? Math.round(totalIncome / deposits.length)
      : 0;
    const averageExpense = expenses.length
      ? totalExpenses / expenses.length
      : 0;
    const monthlyRunway =
      averageExpense > 0
        ? Math.max(0, Math.round(balance / averageExpense))
        : Math.max(0, balance);

    const bySource: Record<string, number> = {};
    for (const e of earnings) {
      const key = e.source;
      bySource[key] = (bySource[key] ?? 0) + e.amount;
    }

    return {
      balance,
      totalIncome,
      totalExpenses,
      averageDeposit,
      monthlyRunway,
      recentActivity: earnings,
      bySource,
    };
  }, [primaryTreasury, canUseLegacyFallback, band?.band_balance, earnings]);

  const topSources = useMemo(() => {
    return Object.entries(aggregated.bySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [aggregated.bySource]);

  const handleSaveWeeklyPay = async () => {
    const clamped = Math.max(0, Math.min(100, weeklyPayPct));
    setSavingPay(true);
    try {
      const { error } = await supabase
        .from("bands")
        .update({ weekly_pay_percent: clamped })
        .eq("id", bandId);
      if (error) throw error;
      toast({
        title: "Weekly Pay Updated",
        description: `${clamped}% of band balance will be paid out each Saturday at 10:00 AM.`,
      });
    } catch (e: unknown) {
      const message = getErrorMessage(e, "Unable to save weekly pay.");
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSavingPay(false);
    }
  };

  const startContributionPreview = async () => {
    const amount = Number(contributionAmount);
    if (!selectedAccountId || !Number.isFinite(amount) || amount <= 0) {
      toast({
        title: "Contribution needs an account and positive amount",
        variant: "destructive",
      });
      return;
    }
    setPreviewingContribution(true);
    try {
      const amountMinor = Math.round(amount * 100);
      const { data, error } = await financeRpc.rpc(
        "preview_my_band_contribution",
        {
          p_band_id: bandId,
          p_bank_account_id: selectedAccountId,
          p_amount_minor: amountMinor,
        },
      );
      if (error) throw error;
      setContributionPreview(data);
      setContributionIdempotencyKey(crypto.randomUUID());
    } catch (e: unknown) {
      const message = getErrorMessage(e, "Unable to preview contribution.");
      toast({
        title: "Contribution preview failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setPreviewingContribution(false);
    }
  };

  const handleContribute = async () => {
    if (!contributionPreview || !contributionIdempotencyKey) return;
    setContributing(true);
    try {
      const { data, error } = await financeRpc.rpc(
        "contribute_my_personal_funds_to_band",
        {
          p_band_id: bandId,
          p_bank_account_id: selectedAccountId,
          p_amount_minor: contributionPreview.amountMinor,
          p_note: contributionNote || null,
          p_idempotency_key: contributionIdempotencyKey,
        },
      );
      if (error) throw error;
      toast({
        title: "Contribution posted",
        description:
          "Your personal account was debited and the band treasury was credited.",
      });
      setContributionAmount("");
      setContributionNote("");
      setContributionPreview(null);
      setContributionIdempotencyKey(null);
      if (data?.newPlayerAvailableBalance !== undefined) {
        setPersonalAccounts((accounts) =>
          accounts.map((account) =>
            account.id === selectedAccountId
              ? {
                  ...account,
                  availableBalanceMinor:
                    data.newPlayerAvailableBalance ??
                    account.availableBalanceMinor,
                }
              : account,
          ),
        );
      }
      void fetchFinances();
      void fetchEligibleAccounts();
    } catch (e: unknown) {
      const message = getErrorMessage(e, "Unable to post contribution.");
      toast({
        title: "Contribution failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setContributing(false);
    }
  };

  const projectedTotal = Math.floor(
    (aggregated.balance * Math.max(0, Math.min(100, weeklyPayPct))) / 100,
  );
  const projectedPerMember =
    memberCount > 0 ? Math.floor(projectedTotal / memberCount) : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(4)].map((__, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load band finances</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!band)
    return <p className="text-sm text-muted-foreground">Band not found.</p>;

  return (
    <div className="space-y-6">
      {dashboardError && (
        <Alert variant="destructive">
          <AlertTitle>Band treasury could not be loaded.</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Your other finance information is still available.</p>
            <p className="text-xs">{dashboardError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchTreasuryDashboard()}
              disabled={dashboardLoading}
            >
              {dashboardLoading ? "Retrying treasury…" : "Retry treasury"}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {!dashboardError && dashboard?.status === "treasury_missing" && (
        <Alert>
          <AlertTitle>Band treasury is not available yet.</AlertTitle>
          <AlertDescription>
            Showing the legacy band balance until a ledger treasury is
            available.
          </AlertDescription>
        </Alert>
      )}
      {!dashboardError && dashboard?.status === "permission_denied" && (
        <Alert variant="destructive">
          <AlertTitle>Band treasury permission required.</AlertTitle>
          <AlertDescription>
            You do not have permission to view this band treasury. Legacy
            balance fallback is disabled for explicit permission denials.
          </AlertDescription>
        </Alert>
      )}
      {!dashboardError && dashboard?.status === "profile_missing" && (
        <Alert variant="destructive">
          <AlertTitle>Active profile required.</AlertTitle>
          <AlertDescription>
            Select or create an active player profile before using Band
            Finances.
          </AlertDescription>
        </Alert>
      )}
      {!dashboardError && dashboard?.status === "band_missing" && (
        <Alert variant="destructive">
          <AlertTitle>Band not found.</AlertTitle>
          <AlertDescription>
            This band could not be found by the treasury dashboard.
          </AlertDescription>
        </Alert>
      )}
      {balanceSource === "legacy_fallback" && (
        <Alert>
          <AlertTitle>Legacy balance fallback active</AlertTitle>
          <AlertDescription>
            Ledger treasury data is unavailable, so this page is using the
            existing band balance.
          </AlertDescription>
        </Alert>
      )}
      {/* Key metrics */}
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <PiggyBank className="h-3.5 w-3.5" /> Balance
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(aggregated.balance, treasuryCurrency)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> Total
              Income
            </div>
            <p className="text-2xl font-bold text-emerald-500">
              {formatCurrency(aggregated.totalIncome, treasuryCurrency)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <ArrowDownRight className="h-3.5 w-3.5 text-destructive" /> Total
              Expenses
            </div>
            <p className="text-2xl font-bold text-destructive">
              {formatCurrency(aggregated.totalExpenses, treasuryCurrency)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Runway
            </div>
            <p className="text-2xl font-bold">
              {aggregated.monthlyRunway}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                months
              </span>
            </p>
            <Progress
              value={Math.min(100, aggregated.monthlyRunway * 10)}
              className="mt-1 h-1.5"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HandCoins className="h-4 w-4" /> Add Money to Band
            </CardTitle>
            <CardDescription>
              Move personal funds into the {treasuryCurrency} band treasury with
              explicit confirmation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Personal account</Label>
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
                disabled={
                  accountsLoading ||
                  personalAccounts.length === 0 ||
                  dashboardStatus === "permission_denied" ||
                  dashboardStatus === "profile_missing" ||
                  dashboardStatus === "band_missing"
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      accountsLoading
                        ? "Loading your personal accounts…"
                        : "Choose a personal account"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {personalAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex flex-col text-left">
                        <span>
                          {account.displayName} {account.maskedAccountNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {account.providerName} ·{" "}
                          {formatCurrency(
                            account.availableBalanceMinor / 100,
                            account.currencyCode,
                          )}{" "}
                          available
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {accountsLoading && (
                <p className="text-xs text-muted-foreground">
                  Loading your personal accounts…
                </p>
              )}
              {accountError && (
                <p className="text-xs text-destructive">
                  Unable to load accounts: {accountError}
                </p>
              )}
              {!accountsLoading &&
                !accountError &&
                personalAccounts.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No eligible personal account found. Open or fund a personal
                    bank account before contributing to the band.{" "}
                    {accountStatus === "currency_mismatch"
                      ? "Only matching-currency accounts are eligible."
                      : null}{" "}
                    <a className="underline" href="/finance/banking">
                      Go to personal banking
                    </a>
                    .
                  </p>
                )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  placeholder="50.00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Optional note</Label>
                <Input
                  value={contributionNote}
                  onChange={(e) => setContributionNote(e.target.value)}
                  placeholder="New rehearsal fund"
                />
              </div>
            </div>
            <Alert>
              <AlertTitle>Contribution warning</AlertTitle>
              <AlertDescription>
                This contribution is not automatically repayable and does not
                grant additional band ownership or voting rights.
              </AlertDescription>
            </Alert>
            <Button
              onClick={startContributionPreview}
              disabled={
                previewingContribution ||
                contributing ||
                accountsLoading ||
                !selectedAccountId ||
                dashboardStatus === "permission_denied" ||
                dashboardStatus === "profile_missing" ||
                dashboardStatus === "band_missing"
              }
            >
              {previewingContribution
                ? "Preparing preview…"
                : "Preview contribution"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Member Contributions</CardTitle>
            <CardDescription>
              Voluntary deposits, personal expense payments, shortfalls and
              refunds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contributions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No contributions recorded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {contributions.map((c) => (
                  <div key={c.id} className="rounded-md border p-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">
                        {c.contributorDisplayName} ·{" "}
                        {getSourceLabel(c.contributionType)}
                      </span>
                      <Badge>
                        {formatCurrency(
                          (c.amountMinor ?? 0) / 100,
                          c.currencyCode,
                        )}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.currencyCode} · {formatDateTime(c.createdAt)} · refund:{" "}
                      {c.refundableStatus}
                    </p>

                    {c.notes && <p className="text-xs">{c.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue breakdown + Weekly pay settings */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue by source */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Revenue Breakdown
            </CardTitle>
            <CardDescription>Earnings & expenses by source</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              topSources.map(([source, amount]) => {
                const maxAbs = Math.max(
                  ...topSources.map(([, v]) => Math.abs(v)),
                  1,
                );
                return (
                  <div key={source} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 w-32 shrink-0 text-xs">
                      {sourceIcons[source] ?? (
                        <Receipt className="h-3.5 w-3.5" />
                      )}
                      <span className="truncate">{getSourceLabel(source)}</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${amount >= 0 ? "bg-emerald-500" : "bg-destructive"}`}
                          style={{
                            width: `${Math.min(100, (Math.abs(amount) / maxAbs) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold w-16 text-right ${amount >= 0 ? "text-emerald-500" : "text-destructive"}`}
                    >
                      {formatCurrency(amount, treasuryCurrency)}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Weekly Pay Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" /> Weekly Member Pay
            </CardTitle>
            <CardDescription>
              Automatic payroll — every Saturday at 10:00 AM. A % of the band
              balance is split equally between real player members.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Real members:</span>
                <span className="font-semibold text-foreground">
                  {memberCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Configured rate:</span>
                <span className="font-semibold text-foreground">
                  {weeklyPayPct}% of balance
                </span>
              </div>
              <div className="flex justify-between">
                <span>Projected total payout:</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(projectedTotal, treasuryCurrency)}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 mt-1">
                <span>Per member / week:</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(projectedPerMember, treasuryCurrency)}
                </span>
              </div>
            </div>

            {isLeader ? (
              <div className="space-y-2">
                <Label htmlFor="weekly-pay" className="text-xs">
                  % of band balance per week (0–100)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="weekly-pay"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={weeklyPayPct}
                    onChange={(e) =>
                      setWeeklyPayPct(
                        Math.max(
                          0,
                          Math.min(100, parseFloat(e.target.value) || 0),
                        ),
                      )
                    }
                    className="h-9"
                  />
                  <Button
                    onClick={handleSaveWeeklyPay}
                    disabled={savingPay}
                    size="sm"
                    className="h-9 px-4"
                  >
                    {savingPay ? "Saving…" : "Save"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Example: 10% of a{" "}
                  {formatCurrency(aggregated.balance, treasuryCurrency)} balance
                  ={" "}
                  {formatCurrency(
                    Math.floor(aggregated.balance * 0.1),
                    treasuryCurrency,
                  )}{" "}
                  split between members.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Only the band leader can change this setting.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Transactions</CardTitle>
          <CardDescription>
            Last {aggregated.recentActivity.length} financial entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {aggregated.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transactions recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Description
                    </TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregated.recentActivity.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="text-muted-foreground">
                            {sourceIcons[entry.source] ?? (
                              <Receipt className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <span className="text-xs font-medium">
                            {getSourceLabel(entry.source)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            entry.amount >= 0 ? "default" : "destructive"
                          }
                          className="text-xs"
                        >
                          {entry.amount >= 0 ? "+" : ""}
                          {formatCurrency(entry.amount, treasuryCurrency)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                        {entry.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(entry.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog
        open={!!contributionPreview}
        onOpenChange={(open) => {
          if (!open && !contributing) setContributionPreview(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm band contribution</AlertDialogTitle>
            <AlertDialogDescription>
              Review the source account, destination treasury and resulting
              balances before posting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {contributionPreview && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-3 space-y-1">
                <p className="font-medium">
                  From: {contributionPreview.sourceAccountDisplay}
                </p>
                <p>
                  Personal balance:{" "}
                  {formatCurrency(
                    contributionPreview.currentPersonalBalanceMinor / 100,
                    contributionPreview.currencyCode,
                  )}
                </p>
                <p>
                  Contribution:{" "}
                  {formatCurrency(
                    contributionPreview.amountMinor / 100,
                    contributionPreview.currencyCode,
                  )}
                </p>
                <p>
                  Resulting personal balance:{" "}
                  {formatCurrency(
                    contributionPreview.resultingPersonalBalanceMinor / 100,
                    contributionPreview.currencyCode,
                  )}
                </p>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <p className="font-medium">
                  To: {contributionPreview.destinationTreasuryName}
                </p>
                <p>
                  Current treasury balance:{" "}
                  {formatCurrency(
                    contributionPreview.currentTreasuryBalanceMinor / 100,
                    contributionPreview.currencyCode,
                  )}
                </p>
                <p>
                  Resulting treasury balance:{" "}
                  {formatCurrency(
                    contributionPreview.resultingTreasuryBalanceMinor / 100,
                    contributionPreview.currencyCode,
                  )}
                </p>
              </div>
              <Alert>
                <AlertTitle>Contribution warning</AlertTitle>
                <AlertDescription>
                  {contributionPreview.warningText}
                </AlertDescription>
              </Alert>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={contributing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleContribute();
              }}
              disabled={contributing || !contributionPreview?.eligible}
            >
              {contributing ? "Confirming…" : "Confirm contribution"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default BandFinancesTab;
