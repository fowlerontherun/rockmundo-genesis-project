import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Target } from "lucide-react";
import { toast } from "sonner";
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
import {
  createSavingsGoal,
  fundSavingsGoal,
  getSavingsGoalFundingSources,
  previewSavingsGoalFunding,
  type SavingsGoalFundingPreview,
  type SavingsGoalFundingSource,
} from "@/lib/api/savingsGoals";
import { formatCurrencyMinor } from "@/services/banking/bankingService";

export type BankingSavingsGoal = {
  id: string;
  name: string;
  targetMinor: number;
  currentMinor: number;
  currencyCode: string;
  completionBps?: number;
  projectedCompletionDate?: string | null;
};

const parseAmountMinor = (value: string): number | null => {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const amountMinor =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(amountMinor) ? amountMinor : null;
};

const sourceKeyFor = (source: SavingsGoalFundingSource) =>
  `${source.sourceKind}:${source.sourceAccountId ?? "wallet"}`;

const errorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("insufficient")) {
    return "There is not enough money in the selected funding source.";
  }
  if (message.includes("currency_mismatch")) {
    return "The selected funding source uses a different currency from this goal.";
  }
  if (message.includes("source_account_ineligible")) {
    return "The selected account is locked or cannot currently make this transfer.";
  }
  return message || "The savings goal action could not be completed.";
};

export function SavingsGoalsPanel({
  goals,
  currencyCode,
  onChanged,
}: {
  goals: BankingSavingsGoal[];
  currencyCode: string;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateSavingsGoalDialog currencyCode={currencyCode} onChanged={onChanged} />
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No savings goals yet. Create one for a new guitar, tour bus or studio deposit.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => (
            <SavingsGoalCard key={goal.id} goal={goal} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateSavingsGoalDialog({
  currencyCode,
  onChanged,
}: {
  currencyCode: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const targetMinor = useMemo(() => parseAmountMinor(target), [target]);

  const mutation = useMutation({
    mutationFn: () =>
      createSavingsGoal({
        name: name.trim(),
        targetMinor: targetMinor ?? 0,
        targetDate: targetDate || null,
      }),
    onSuccess: () => {
      toast.success("Savings goal created");
      setOpen(false);
      setName("");
      setTarget("");
      setTargetDate("");
      onChanged();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const valid = name.trim().length >= 2 && targetMinor !== null && targetMinor > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create savings goal</DialogTitle>
          <DialogDescription>
            Goal money is ring-fenced in the canonical ledger and remains part of this
            character&apos;s net worth.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New guitar"
            />
          </div>
          <div className="space-y-1">
            <Label>Target ({currencyCode})</Label>
            <Input
              inputMode="decimal"
              min="0"
              step="0.01"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label>Target date (optional)</Label>
            <Input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !valid}
          >
            {mutation.isPending ? "Creating…" : "Create goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SavingsGoalCard({
  goal,
  onChanged,
}: {
  goal: BankingSavingsGoal;
  onChanged: () => void;
}) {
  const percentage = Math.min(
    100,
    goal.completionBps !== undefined
      ? goal.completionBps / 100
      : goal.targetMinor > 0
        ? (goal.currentMinor / goal.targetMinor) * 100
        : 0,
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            {goal.name}
          </CardTitle>
          <span className="text-sm text-muted-foreground">{percentage.toFixed(0)}%</span>
        </div>
        {goal.projectedCompletionDate && (
          <CardDescription>Target date: {goal.projectedCompletionDate}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatCurrencyMinor({
            amountMinor: goal.currentMinor,
            currencyCode: goal.currencyCode,
          })}{" "}
          of{" "}
          {formatCurrencyMinor({
            amountMinor: goal.targetMinor,
            currencyCode: goal.currencyCode,
          })}
        </p>
        <FundSavingsGoalDialog goal={goal} onChanged={onChanged} />
      </CardContent>
    </Card>
  );
}

function FundSavingsGoalDialog({
  goal,
  onChanged,
}: {
  goal: BankingSavingsGoal;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<SavingsGoalFundingSource[]>([]);
  const [sourceKey, setSourceKey] = useState("");
  const [amount, setAmount] = useState("");
  const [preview, setPreview] = useState<SavingsGoalFundingPreview | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const source = useMemo(
    () => sources.find((candidate) => sourceKeyFor(candidate) === sourceKey),
    [sourceKey, sources],
  );
  const amountMinor = useMemo(() => parseAmountMinor(amount), [amount]);
  const walletNeedsWholeUnits =
    source?.sourceKind === "wallet" &&
    amountMinor !== null &&
    amountMinor % 100 !== 0;

  const resetPreview = () => {
    setPreview(null);
    setIdempotencyKey(null);
  };

  const loadSources = async () => {
    setLoadingSources(true);
    setError(null);
    resetPreview();
    try {
      const result = await getSavingsGoalFundingSources(goal.id);
      const nextSources = result.sources ?? [];
      const eligibleSources = nextSources.filter((candidate) => candidate.eligible);
      const preferredSource =
        eligibleSources.find((candidate) => candidate.sourceKind === "wallet") ??
        eligibleSources[0] ??
        null;
      setSources(nextSources);
      setSourceKey(preferredSource ? sourceKeyFor(preferredSource) : "");
    } catch (loadError) {
      setSources([]);
      setSourceKey("");
      setError(errorMessage(loadError));
    } finally {
      setLoadingSources(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadSources();
    // The goal id is stable for the lifetime of this card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal.id]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setAmount("");
      setSources([]);
      setSourceKey("");
      setError(null);
      resetPreview();
    }
  };

  const preparePreview = async () => {
    if (!source?.eligible || amountMinor === null || amountMinor <= 0) return;
    if (walletNeedsWholeUnits) return;

    setSubmitting(true);
    setError(null);
    try {
      const nextPreview = await previewSavingsGoalFunding({
        goalId: goal.id,
        sourceKind: source.sourceKind,
        sourceAccountId: source.sourceAccountId,
        amountMinor,
      });
      setPreview(nextPreview);
      setIdempotencyKey(crypto.randomUUID());
    } catch (previewError) {
      setError(errorMessage(previewError));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmFunding = async () => {
    if (!source?.eligible || !preview || !idempotencyKey) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await fundSavingsGoal({
        goalId: goal.id,
        sourceKind: source.sourceKind,
        sourceAccountId: source.sourceAccountId,
        amountMinor: preview.amountMinor,
        idempotencyKey,
      });
      toast.success(result.completed ? "Savings goal completed" : "Savings goal funded");
      handleOpenChange(false);
      onChanged();
    } catch (fundingError) {
      setError(errorMessage(fundingError));
    } finally {
      setSubmitting(false);
    }
  };

  const hasEligibleSource = sources.some((candidate) => candidate.eligible);
  const amountIsValid =
    amountMinor !== null &&
    amountMinor > 0 &&
    !walletNeedsWholeUnits &&
    Boolean(source?.eligible);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="mt-3">
          Add money
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add money to {goal.name}</DialogTitle>
          <DialogDescription>
            Pay directly from character cash or choose an eligible bank account. Review
            both balances before confirming.
          </DialogDescription>
        </DialogHeader>

        {loadingSources ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading available funds…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Funding source</Label>
              <Select
                value={sourceKey}
                onValueChange={(value) => {
                  setSourceKey(value);
                  setError(null);
                  resetPreview();
                }}
                disabled={!hasEligibleSource}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select wallet or account" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((candidate) => (
                    <SelectItem
                      key={sourceKeyFor(candidate)}
                      value={sourceKeyFor(candidate)}
                      disabled={!candidate.eligible}
                    >
                      {candidate.displayName} ·{" "}
                      {formatCurrencyMinor({
                        amountMinor: candidate.availableBalanceMinor,
                        currencyCode: candidate.currencyCode,
                      })}
                      {candidate.sourceKind === "wallet" ? " · Recommended" : ""}
                      {!candidate.eligible && candidate.ineligibleReason
                        ? ` · ${candidate.ineligibleReason}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Amount ({source?.currencyCode ?? goal.currencyCode})</Label>
              <Input
                inputMode="decimal"
                min="0"
                step={source?.sourceKind === "wallet" ? "1" : "0.01"}
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError(null);
                  resetPreview();
                }}
                placeholder="0.00"
              />
            </div>

            {walletNeedsWholeUnits && (
              <p className="text-xs text-destructive">
                Character wallet payments must use whole currency units.
              </p>
            )}

            {!hasEligibleSource && !error && (
              <p className="text-sm text-muted-foreground">
                There are no available matching-currency funds for this goal.
              </p>
            )}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {preview && (
              <div className="space-y-1 rounded-md border p-3 text-sm">
                <p>
                  Source:{" "}
                  {formatCurrencyMinor({
                    amountMinor: preview.sourceBalanceMinor,
                    currencyCode: preview.currencyCode,
                  })}{" "}
                  →{" "}
                  <strong>
                    {formatCurrencyMinor({
                      amountMinor: preview.resultingSourceBalanceMinor,
                      currencyCode: preview.currencyCode,
                    })}
                  </strong>
                </p>
                <p>
                  Goal:{" "}
                  {formatCurrencyMinor({
                    amountMinor: preview.goalBalanceMinor,
                    currencyCode: preview.currencyCode,
                  })}{" "}
                  →{" "}
                  <strong>
                    {formatCurrencyMinor({
                      amountMinor: preview.resultingGoalBalanceMinor,
                      currencyCode: preview.currencyCode,
                    })}
                  </strong>
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={() => void (preview ? confirmFunding() : preparePreview())}
            disabled={loadingSources || submitting || !amountIsValid}
          >
            {submitting
              ? "Working…"
              : preview
                ? "Confirm saving"
                : "Preview balances"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
