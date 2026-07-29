import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyMinor } from "@/services/banking/bankingService";
import { toast } from "sonner";
import { HandCoins, Loader2 } from "lucide-react";

type FundingSource = {
  sourceKind: "wallet" | "bank";
  sourceAccountId: string | null;
  displayName: string;
  accountType: string;
  currencyCode: string;
  availableBalanceMinor: number;
  eligible: boolean;
  ineligibleReason?: string | null;
};

type FundingPreview = {
  sourceDisplay: string;
  currencyCode: string;
  sourceBalanceMinor: number;
  amountMinor: number;
  resultingSourceBalanceMinor: number;
  treasuryBalanceMinor: number;
  resultingTreasuryBalanceMinor: number;
  treasuryWillBeCreated: boolean;
};

const sourceKeyFor = (source: FundingSource) =>
  `${source.sourceKind}:${source.sourceAccountId ?? "wallet"}`;

export const parseFundingAmountMinor = (value: string): number | null => {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const amountMinor =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(amountMinor) ? amountMinor : null;
};

const fundingErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message.includes("permission_denied")) {
    return "This band is missing contribution permissions. Retry after the finance repair is deployed.";
  }
  if (message.includes("not_band_member")) {
    return "Only active members can add money to this band.";
  }
  if (message.includes("insufficient")) {
    return "There is not enough money in the selected funding source.";
  }
  if (message.includes("currency_mismatch")) {
    return "The selected source uses a different currency from the band treasury.";
  }

  return message || "Band funding could not be loaded. Please try again.";
};

export function AddMoneyToBand({
  bandId: fixedBandId,
  onComplete,
}: {
  bandId?: string;
  onComplete?: () => void;
}) {
  const { profileId, isLoading: profileLoading } = useActiveProfile();
  const [bands, setBands] = useState<Array<{ id: string; name: string }>>([]);
  const [bandId, setBandId] = useState(fixedBandId ?? "");
  const [sources, setSources] = useState<FundingSource[]>([]);
  const [sourceKey, setSourceKey] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<FundingPreview | null>(null);
  const [confirmationKey, setConfirmationKey] = useState<string | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceRequestGeneration = useRef(0);

  const source = useMemo(
    () => sources.find((candidate) => sourceKeyFor(candidate) === sourceKey),
    [sources, sourceKey],
  );
  const amountMinor = useMemo(() => parseFundingAmountMinor(amount), [amount]);
  const walletNeedsWholeUnits =
    source?.sourceKind === "wallet" &&
    amountMinor !== null &&
    amountMinor % 100 !== 0;

  useEffect(() => {
    if (fixedBandId !== undefined) setBandId(fixedBandId);
  }, [fixedBandId]);

  useEffect(() => {
    setSources([]);
    setSourceKey("");
    setAmount("");
    setNote("");
    setPreview(null);
    setConfirmationKey(null);
    setError(null);
  }, [bandId, profileId]);

  useEffect(() => {
    if (fixedBandId || !profileId) return;

    let cancelled = false;
    void supabase
      .from("band_members")
      .select("band_id,bands(id,name)")
      .eq("profile_id", profileId)
      .eq("member_status", "active")
      .then(({ data, error: bandsError }) => {
        if (cancelled) return;
        if (bandsError) {
          setError(fundingErrorMessage(bandsError));
          return;
        }

        setBands(
          (data ?? [])
            .map((row: any) => row.bands)
            .filter(Boolean) as Array<{ id: string; name: string }>,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [fixedBandId, profileId]);

  const loadSources = useCallback(async () => {
    const generation = ++sourceRequestGeneration.current;

    if (!bandId || !profileId) {
      setSources([]);
      setSourceKey("");
      return;
    }

    setSourcesLoading(true);
    setError(null);
    setPreview(null);
    setConfirmationKey(null);

    try {
      const { data, error: sourcesError } = await (supabase as any).rpc(
        "get_my_band_funding_sources",
        { p_band_id: bandId },
      );
      if (sourcesError) throw sourcesError;
      if (generation !== sourceRequestGeneration.current) return;

      const nextSources = Array.isArray(data?.sources)
        ? (data.sources as FundingSource[])
        : [];
      const eligibleSources = nextSources.filter((candidate) => candidate.eligible);
      const preferredSource =
        eligibleSources.find((candidate) => candidate.sourceKind === "wallet") ??
        eligibleSources[0] ??
        null;

      setSources(nextSources);
      setSourceKey(preferredSource ? sourceKeyFor(preferredSource) : "");
    } catch (loadError) {
      if (generation !== sourceRequestGeneration.current) return;
      setSources([]);
      setSourceKey("");
      setError(fundingErrorMessage(loadError));
    } finally {
      if (generation === sourceRequestGeneration.current) setSourcesLoading(false);
    }
  }, [bandId, profileId]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const resetPreview = () => {
    setPreview(null);
    setConfirmationKey(null);
  };

  const previewFunding = async () => {
    if (!source?.eligible || amountMinor === null || amountMinor <= 0) return;
    if (walletNeedsWholeUnits) return;

    setSubmitting(true);
    setError(null);
    try {
      const { data, error: previewError } = await (supabase as any).rpc(
        "preview_my_band_funding",
        {
          p_band_id: bandId,
          p_source_kind: source.sourceKind,
          p_source_account_id: source.sourceAccountId,
          p_amount_minor: amountMinor,
        },
      );
      if (previewError) throw previewError;

      setPreview(data as FundingPreview);
      setConfirmationKey(crypto.randomUUID());
    } catch (previewError) {
      setError(fundingErrorMessage(previewError));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmFunding = async () => {
    if (!preview || !source?.eligible || !confirmationKey) return;

    setSubmitting(true);
    setError(null);
    try {
      const { error: fundingError } = await (supabase as any).rpc("fund_my_band", {
        p_band_id: bandId,
        p_source_kind: source.sourceKind,
        p_source_account_id: source.sourceAccountId,
        p_amount_minor: preview.amountMinor,
        p_note: note.trim() || null,
        p_idempotency_key: confirmationKey,
      });
      if (fundingError) throw fundingError;

      toast.success("Band funded");
      setAmount("");
      setNote("");
      resetPreview();
      await loadSources();
      onComplete?.();
    } catch (fundingError) {
      setError(fundingErrorMessage(fundingError));
    } finally {
      setSubmitting(false);
    }
  };

  const hasEligibleSource = sources.some((candidate) => candidate.eligible);
  const amountIsValid =
    amountMinor !== null &&
    amountMinor > 0 &&
    !walletNeedsWholeUnits &&
    !!source?.eligible;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HandCoins className="h-5 w-5" />
          Add money to band
        </CardTitle>
        <CardDescription>
          Pay directly from this character&apos;s wallet, or choose an eligible bank
          account. Opening a bank account first is not required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!fixedBandId && (
          <div className="space-y-1">
            <Label>Band</Label>
            <Select value={bandId} onValueChange={setBandId}>
              <SelectTrigger>
                <SelectValue placeholder="Select band" />
              </SelectTrigger>
              <SelectContent>
                {bands.map((band) => (
                  <SelectItem key={band.id} value={band.id}>
                    {band.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!profileLoading && bands.length === 0 && (
              <p className="text-xs text-muted-foreground">
                This character is not an active member of a band.
              </p>
            )}
          </div>
        )}

        {profileLoading || sourcesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading available funds…
          </div>
        ) : bandId ? (
          <>
            <div className="space-y-1">
              <Label>Funding source</Label>
              <Select
                value={sourceKey}
                onValueChange={(value) => {
                  setSourceKey(value);
                  resetPreview();
                  setError(null);
                }}
                disabled={!hasEligibleSource}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select wallet or account" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((candidate) => (
                    <SelectItem
                      disabled={!candidate.eligible}
                      key={sourceKeyFor(candidate)}
                      value={sourceKeyFor(candidate)}
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
              {!hasEligibleSource && !error && (
                <p className="text-xs text-muted-foreground">
                  There are no available funds in this character&apos;s wallet or bank
                  accounts.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Amount ({source?.currencyCode ?? "currency"})</Label>
                <Input
                  inputMode="decimal"
                  min="0"
                  step={source?.sourceKind === "wallet" ? "1" : "0.01"}
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    resetPreview();
                    setError(null);
                  }}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label>Note (optional)</Label>
                <Input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Rehearsal fund"
                />
              </div>
            </div>

            {walletNeedsWholeUnits && (
              <p className="text-xs text-destructive">
                Character wallet payments must use whole currency units.
              </p>
            )}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <p>{error}</p>
                <Button
                  className="mt-2"
                  size="sm"
                  variant="outline"
                  onClick={() => void loadSources()}
                >
                  Retry
                </Button>
              </div>
            )}

            {preview && (
              <div className="space-y-1 rounded-md border p-3 text-sm">
                <p>
                  Source: {formatCurrencyMinor({
                    amountMinor: preview.sourceBalanceMinor,
                    currencyCode: preview.currencyCode,
                  })}{" "}
                  → <strong>{formatCurrencyMinor({
                    amountMinor: preview.resultingSourceBalanceMinor,
                    currencyCode: preview.currencyCode,
                  })}</strong>
                </p>
                <p>
                  Band {preview.currencyCode} treasury:{" "}
                  {formatCurrencyMinor({
                    amountMinor: preview.treasuryBalanceMinor,
                    currencyCode: preview.currencyCode,
                  })}{" "}
                  → <strong>{formatCurrencyMinor({
                    amountMinor: preview.resultingTreasuryBalanceMinor,
                    currencyCode: preview.currencyCode,
                  })}</strong>
                  {preview.treasuryWillBeCreated ? " (new treasury)" : ""}
                </p>
              </div>
            )}

            <Button
              disabled={submitting || !amountIsValid}
              onClick={() => void (preview ? confirmFunding() : previewFunding())}
            >
              {submitting
                ? "Working…"
                : preview
                  ? "Confirm band funding"
                  : "Preview band funding"}
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
