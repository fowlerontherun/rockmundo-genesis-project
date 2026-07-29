import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  Landmark,
  Loader2,
  PiggyBank,
  Plus,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AddMoneyToBand } from "@/components/bands/AddMoneyToBand";
import { SavingsGoalsPanel } from "@/components/banking/SavingsGoalsPanel";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  depositWalletToBank,
  transferBetweenBankAccounts,
  withdrawBankToWallet,
  type WalletBankTransferResult,
} from "@/lib/api/personalBanking";
import {
  fetchBankingDashboard,
  formatCurrencyMinor,
} from "@/services/banking/bankingService";

type BankingAccount = {
  id: string;
  nickname?: string | null;
  providerName: string;
  accountType: string;
  currencyCode: string;
  annualRateBps?: number | null;
  balanceMinor: number;
  restrictionSummary?: string | null;
};

type BankingActivity = {
  id: string;
  description?: string | null;
  txType: string;
  createdAt: string;
  amountMinor: number;
  currencyCode: string;
};

function errMsg(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("insufficient")) return "There is not enough money available.";
  if (message.includes("wallet_amount_must_be_whole_major_units")) {
    return "Character wallet transfers must use whole currency units.";
  }
  if (message.includes("currency_mismatch")) {
    return "These accounts use different currencies and cannot be transferred directly.";
  }
  if (message.includes("idempotency_key_conflict")) {
    return "These transfer details changed after the operation started. Close this window and try again.";
  }
  return message || "Something went wrong.";
}

const parseAmountMinor = (value: string): number | null => {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const amountMinor =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(amountMinor) ? amountMinor : null;
};

const operationKey = () => crypto.randomUUID();

export default function Banking() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["banking-dashboard"],
    queryFn: fetchBankingDashboard,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["banking-dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["profile"] }),
      queryClient.invalidateQueries({ queryKey: ["active-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["financial-account"] }),
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] }),
    ]);
  };

  if (isLoading) {
    return (
      <FMPageScaffold
        title="Banking"
        subtitle="Personal accounts, savings, fixed deposits, goals and band funding."
        icon={Landmark}
        backTo="/finances"
      >
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </FMPageScaffold>
    );
  }

  if (error) {
    return (
      <FMPageScaffold
        title="Banking"
        subtitle="Personal accounts, savings, fixed deposits, goals and band funding."
        icon={Landmark}
        backTo="/finances"
      >
        <Card>
          <CardHeader>
            <CardTitle>Banking unavailable</CardTitle>
            <CardDescription>{errMsg(error)}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  const accounts = (data?.accounts ?? []) as BankingAccount[];
  const goals = data?.savingsGoals ?? [];
  const recent = (data?.recentActivity ?? []) as BankingActivity[];
  const summary = data?.savingsSummary;
  const currency = summary?.currencyCode ?? "GBP";

  return (
    <FMPageScaffold
      title="Banking"
      subtitle="Personal accounts, savings, fixed deposits, goals and band funding."
      icon={Landmark}
      backTo="/finances"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            icon={<WalletCards className="h-5 w-5" />}
            label="Net worth"
            value={formatCurrencyMinor({ amountMinor: summary?.netWorthMinor ?? 0, currencyCode: currency })}
            hint="Wallet + bank + goals"
          />
          <StatCard
            icon={<PiggyBank className="h-5 w-5" />}
            label="Savings"
            value={formatCurrencyMinor({ amountMinor: summary?.savingsMinor ?? 0, currencyCode: currency })}
            hint="Accounts and goals"
          />
          <StatCard
            icon={<CalendarClock className="h-5 w-5" />}
            label="Locked deposits"
            value={formatCurrencyMinor({ amountMinor: summary?.lockedDepositsMinor ?? 0, currencyCode: currency })}
            hint="Fixed term"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Wallet cash"
            value={formatCurrencyMinor({ amountMinor: summary?.cashMinor ?? 0, currencyCode: currency })}
            hint="Available now"
          />
        </div>

        <Tabs defaultValue="accounts">
          <TabsList>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="statements">Statements</TabsTrigger>
            <TabsTrigger value="band">Fund band</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-4">
            <div className="flex justify-end">
              <OpenAccountDialog currencyCode={currency} onDone={invalidate} />
            </div>
            {accounts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No accounts yet. Open your first current or savings account to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {accounts.map((account) => (
                  <AccountCard key={account.id} account={account} accounts={accounts} onDone={invalidate} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="goals">
            <SavingsGoalsPanel goals={goals} currencyCode={currency} onChanged={invalidate} />
          </TabsContent>

          <TabsContent value="statements">
            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>
                  Latest transactions across your wallet, accounts and savings goals.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No transactions yet.</p>
                ) : (
                  recent.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between border-b py-2 text-sm last:border-0"
                    >
                      <div>
                        <div className="font-medium">{transaction.description ?? transaction.txType}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(transaction.createdAt), "PPp")} · {transaction.txType}
                        </div>
                      </div>
                      <div className="font-semibold">
                        {formatCurrencyMinor({
                          amountMinor: transaction.amountMinor,
                          currencyCode: transaction.currencyCode,
                        })}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="band">
            <AddMoneyToBand onComplete={invalidate} />
          </TabsContent>
        </Tabs>
      </div>
    </FMPageScaffold>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function AccountCard({
  account,
  accounts,
  onDone,
}: {
  account: BankingAccount;
  accounts: BankingAccount[];
  onDone: () => void | Promise<void>;
}) {
  const compatibleDestinations = accounts.filter(
    (candidate) =>
      candidate.id !== account.id && candidate.currencyCode === account.currencyCode,
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{account.nickname || account.providerName}</CardTitle>
            <CardDescription className="capitalize">
              {account.accountType.replace("_", " ")} · {account.currencyCode} ·{" "}
              {((account.annualRateBps ?? 0) / 100).toFixed(2)}% APR
            </CardDescription>
          </div>
          <Badge variant={account.accountType === "fixed_deposit" ? "secondary" : "outline"}>
            {account.accountType.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-bold">
          {formatCurrencyMinor({ amountMinor: account.balanceMinor, currencyCode: account.currencyCode })}
        </div>
        {account.restrictionSummary && (
          <p className="text-xs text-muted-foreground">{account.restrictionSummary}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <WalletBankDialog operation="deposit" account={account} onDone={onDone} />
          <WalletBankDialog operation="withdraw" account={account} onDone={onDone} />
          <TransferDialog fromAccount={account} accounts={compatibleDestinations} onDone={onDone} />
        </div>
      </CardContent>
    </Card>
  );
}

function OpenAccountDialog({
  currencyCode,
  onDone,
}: {
  currencyCode: string;
  onDone: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"current" | "savings" | "fixed_deposit">("current");
  const [nickname, setNickname] = useState("");
  const [initial, setInitial] = useState("0");
  const [term, setTerm] = useState("6");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const initialMinor = parseAmountMinor(initial);
  const initialIsValid = initialMinor !== null && initialMinor >= 0 && initialMinor % 100 === 0;

  const resetOperation = () => setIdempotencyKey(null);
  const resetDialog = () => {
    setNickname("");
    setInitial("0");
    setTerm("6");
    resetOperation();
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const key = idempotencyKey ?? operationKey();
      if (!idempotencyKey) setIdempotencyKey(key);
      const { data, error } = await (supabase as any).rpc("open_my_bank_account", {
        p_account_type: type,
        p_nickname: nickname.trim() || null,
        p_initial_amount_minor: initialMinor ?? 0,
        p_term_months: type === "fixed_deposit" ? Number(term) : null,
        p_currency_code: currencyCode,
        p_idempotency_key: key,
      });
      if (error) throw new Error(error.message);
      return data as { idempotent?: boolean } | null;
    },
    onSuccess: (result) => {
      toast.success(result?.idempotent ? "Account was already opened — details refreshed" : "Account opened");
      void onDone();
      setOpen(false);
      resetDialog();
    },
    onError: (error) => toast.error(errMsg(error)),
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && !mutation.isPending) resetDialog();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Open account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a bank account</DialogTitle>
          <DialogDescription>
            Current (0%), savings (2.5% APR), or fixed deposit (3–8% APR, locked). The
            account uses this character&apos;s {currencyCode} wallet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Account type</Label>
            <Select
              value={type}
              onValueChange={(value: "current" | "savings" | "fixed_deposit") => {
                setType(value);
                resetOperation();
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="fixed_deposit">Fixed deposit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Nickname (optional)</Label>
            <Input
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                resetOperation();
              }}
              placeholder="Tour fund"
            />
          </div>
          <div className="space-y-1">
            <Label>Opening deposit ({currencyCode})</Label>
            <Input
              inputMode="numeric"
              min="0"
              step="1"
              value={initial}
              onChange={(event) => {
                setInitial(event.target.value);
                resetOperation();
              }}
            />
            {!initialIsValid && (
              <p className="text-xs text-destructive">Opening deposits must use whole currency units.</p>
            )}
          </div>
          {type === "fixed_deposit" && (
            <div className="space-y-1">
              <Label>Term (months)</Label>
              <Select
                value={term}
                onValueChange={(value) => {
                  setTerm(value);
                  resetOperation();
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 6, 12, 24, 36].map((months) => (
                    <SelectItem key={months} value={String(months)}>
                      {months} months ({(3 + months * 0.25).toFixed(2)}% APR)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !initialIsValid}>
            {mutation.isPending ? "Opening…" : idempotencyKey ? "Retry opening" : "Open account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WalletBankDialog({
  operation,
  account,
  onDone,
}: {
  operation: "deposit" | "withdraw";
  account: BankingAccount;
  onDone: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const amountMinor = useMemo(() => parseAmountMinor(amount), [amount]);
  const valid = amountMinor !== null && amountMinor > 0 && amountMinor % 100 === 0;
  const depositing = operation === "deposit";

  const resetDialog = () => {
    setAmount("");
    setIdempotencyKey(null);
  };

  const mutation = useMutation({
    mutationFn: async (): Promise<WalletBankTransferResult> => {
      const key = idempotencyKey ?? operationKey();
      if (!idempotencyKey) setIdempotencyKey(key);
      const input = {
        bankAccountId: account.id,
        amountMinor: amountMinor ?? 0,
        idempotencyKey: key,
      };
      return depositing ? depositWalletToBank(input) : withdrawBankToWallet(input);
    },
    onSuccess: (result) => {
      const action = depositing ? "Deposit" : "Withdrawal";
      toast.success(
        result.idempotent
          ? `${action} was already completed — balances refreshed`
          : `${action} complete`,
      );
      void onDone();
      setOpen(false);
      resetDialog();
    },
    onError: (error) => toast.error(errMsg(error)),
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && !mutation.isPending) resetDialog();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {depositing ? (
            <ArrowDownLeft className="mr-1 h-4 w-4" />
          ) : (
            <ArrowUpRight className="mr-1 h-4 w-4" />
          )}
          {depositing ? "Deposit" : "Withdraw"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{depositing ? "Deposit from wallet" : "Withdraw to wallet"}</DialogTitle>
          <DialogDescription>
            Move whole currency units {depositing ? "from this character's wallet into the account" : "from this account into the character wallet"}.
            A network-error retry will not move the money twice.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Amount ({account.currencyCode})</Label>
          <Input
            inputMode="numeric"
            min="0"
            step="1"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setIdempotencyKey(null);
            }}
          />
          {amount && !valid && (
            <p className="text-xs text-destructive">Wallet transfers must use whole currency units.</p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid}>
            {mutation.isPending ? "Working…" : idempotencyKey ? "Retry safely" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({
  fromAccount,
  accounts,
  onDone,
}: {
  fromAccount: BankingAccount;
  accounts: BankingAccount[];
  onDone: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [destinationId, setDestinationId] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const amountMinor = useMemo(() => parseAmountMinor(amount), [amount]);
  const valid = amountMinor !== null && amountMinor > 0 && Boolean(destinationId);

  const resetDialog = () => {
    setAmount("");
    setDestinationId(accounts[0]?.id ?? "");
    setIdempotencyKey(null);
  };

  const mutation = useMutation({
    mutationFn: () => {
      const key = idempotencyKey ?? operationKey();
      if (!idempotencyKey) setIdempotencyKey(key);
      return transferBetweenBankAccounts({
        sourceBankAccountId: fromAccount.id,
        destinationBankAccountId: destinationId,
        amountMinor: amountMinor ?? 0,
        idempotencyKey: key,
      });
    },
    onSuccess: (result) => {
      toast.success(
        result.idempotent
          ? "Transfer was already completed — balances refreshed"
          : "Transfer complete",
      );
      void onDone();
      setOpen(false);
      resetDialog();
    },
    onError: (error) => toast.error(errMsg(error)),
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && !mutation.isPending) resetDialog();
  };

  if (accounts.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ArrowLeftRight className="mr-1 h-4 w-4" />
          Transfer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer between {fromAccount.currencyCode} accounts</DialogTitle>
          <DialogDescription>
            Currency conversion is not performed. Only matching-currency destinations are
            shown. A network-error retry will reuse the original operation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>To account</Label>
            <Select
              value={destinationId}
              onValueChange={(value) => {
                setDestinationId(value);
                setIdempotencyKey(null);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.nickname || account.providerName} · {account.accountType.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Amount ({fromAccount.currencyCode})</Label>
            <Input
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setIdempotencyKey(null);
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid}>
            {mutation.isPending ? "Working…" : idempotencyKey ? "Retry safely" : "Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
