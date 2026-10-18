import { useEffect, useMemo, useRef, useState } from "react";
import { Landmark } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { acceptLoanOffer, createLoanApplication, estimateEqualPrincipalSchedule, formatCurrencyMinor, getLoanApplicationResult, listEligibleLoanProducts, listPlayerBankAccounts, type BankingProduct, type PlayerBankAccount } from "@/services/banking/bankingService";

export default function BankingApply() {
  const { profileId: activeProfileId, userId, isLoading: profileLoading } = useActiveProfile();
  const scope = `${userId ?? ""}:${activeProfileId ?? ""}`;
  const activeScopeRef = useRef(scope);
  activeScopeRef.current = scope;
  const [products, setProducts] = useState<BankingProduct[]>([]);
  const [accounts, setAccounts] = useState<PlayerBankAccount[]>([]);
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState(50000);
  const [term, setTerm] = useState(6);
  const [purpose, setPurpose] = useState("personal_emergency");
  const [applicationResult, setApplicationResult] = useState<any>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [message, setMessage] = useState<string>();
  const [applicationError, setApplicationError] = useState<string>();
  const [acceptanceError, setAcceptanceError] = useState<string>();
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [applicationPending, setApplicationPending] = useState(false);
  const [acceptancePending, setAcceptancePending] = useState(false);
  const [acceptedContractId, setAcceptedContractId] = useState<string | null>(null);
  const applicationInFlight = useRef<string | null>(null);
  const acceptanceInFlight = useRef<string | null>(null);
  const applicationAttempt = useRef<{ signature: string; key: string; applicationId?: string } | null>(null);
  const acceptanceAttempt = useRef<{ signature: string; key: string; contractId?: string } | null>(null);

  const resetApplication = () => {
    setApplicationResult(null);
    setAcceptedContractId(null);
    setApplicationError(undefined);
    setAcceptanceError(undefined);
    setMessage(undefined);
    applicationAttempt.current = null;
    acceptanceAttempt.current = null;
  };

  const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "The request failed. Please try again.";

  useEffect(() => {
    let cancelled = false;
    // Loan offers and bank accounts must never be reused after a character switch.
    applicationAttempt.current = null;
    acceptanceAttempt.current = null;
    setApplicationResult(null);
    setAcceptedContractId(null);
    setMessage(undefined);
    setApplicationError(undefined);
    setAcceptanceError(undefined);
    setApplicationPending(false);
    setAcceptancePending(false);
    setProducts([]);
    setAccounts([]);
    setProductId("");
    setSelectedAccountId("");
    setCatalogueLoading(true);

    if (!activeProfileId || !userId) {
      setCatalogueLoading(false);
      return () => { cancelled = true; };
    }

    void Promise.all([listEligibleLoanProducts(), listPlayerBankAccounts()])
      .then(([productRows, accountRows]) => {
        if (cancelled) return;
        setProducts(productRows);
        setAccounts(accountRows);
        setProductId(productRows[0]?.id ?? "");
        setSelectedAccountId(accountRows[0]?.id ?? "");
        setPurpose(productRows[0]?.allowedPurposes?.[0] ?? "personal_emergency");
      })
      .catch((error) => {
        if (!cancelled) setMessage(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setCatalogueLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeProfileId, userId]);
  const product = products.find((row) => row.id === productId);
  const schedule = useMemo(() => product && Number.isSafeInteger(term) && term > 0 && term <= 360 && Number.isSafeInteger(amount) && amount > 0 ? estimateEqualPrincipalSchedule({ principalMinor: amount, interestRateBps: product.interestRateBps, termMonths: term }) : [], [amount, product, term]);
  const offer = applicationResult?.offer;

  const validApplication = !!activeProfileId && !!userId && !!product
    && Number.isSafeInteger(amount) && amount >= (product?.minimumAmountMinor ?? Infinity)
    && amount <= (product?.maximumAmountMinor ?? -Infinity)
    && Number.isSafeInteger(term) && term >= (product?.minimumTermMonths ?? Infinity)
    && term <= (product?.maximumTermMonths ?? -Infinity)
    && !!purpose && !!product?.allowedPurposes.includes(purpose);

  async function submitApplication() {
    if (applicationInFlight.current === scope || acceptanceInFlight.current === scope || !validApplication || !product || !activeProfileId || !userId || applicationResult) return;
    const startingScope = scope;
    const signature = JSON.stringify([startingScope, product.id, amount, term, purpose]);
    if (applicationAttempt.current?.signature !== signature) {
      applicationAttempt.current = { signature, key: `ui-${crypto.randomUUID()}` };
    }
    const attempt = applicationAttempt.current;
    applicationInFlight.current = startingScope;
    setApplicationPending(true);
    setApplicationError(undefined);
    setMessage(undefined);
    try {
      if (!attempt.applicationId) {
        attempt.applicationId = await createLoanApplication({
          borrowerType: "player", borrowerId: activeProfileId, productId: product.id,
          requestedAmountMinor: amount, requestedTermMonths: term, purpose,
          expectedUse: "Player starter loan", idempotencyKey: attempt.key,
        });
      }
      const result = await getLoanApplicationResult(attempt.applicationId);
      if (!result) throw new Error("Application status could not be confirmed. Retry to check it.");
      if (activeScopeRef.current !== startingScope) return;
      setApplicationResult(result);
      setMessage("Application received. Review the current decision before accepting any offer.");
    } catch (error) {
      if (activeScopeRef.current === startingScope) setApplicationError(errorMessage(error));
    } finally {
      if (applicationInFlight.current === startingScope) applicationInFlight.current = null;
      if (activeScopeRef.current === startingScope) setApplicationPending(false);
    }
  }

  async function acceptOffer() {
    if (acceptanceInFlight.current === scope || applicationInFlight.current === scope || !activeProfileId || !userId || !offer?.id ||
        !selectedAccountId || !accounts.some((account) => account.id === selectedAccountId && account.status === "active") ||
        acceptedContractId) return;
    const startingScope = scope;
    const signature = JSON.stringify([startingScope, offer.id, selectedAccountId]);
    if (acceptanceAttempt.current?.signature !== signature) {
      acceptanceAttempt.current = { signature, key: `ui-accept-${crypto.randomUUID()}` };
    }
    const attempt = acceptanceAttempt.current;
    acceptanceInFlight.current = startingScope;
    setAcceptancePending(true);
    setAcceptanceError(undefined);
    setMessage(undefined);
    try {
      if (!attempt.contractId) {
        attempt.contractId = await acceptLoanOffer({
          offerId: offer.id, disbursementBankAccountId: selectedAccountId,
          repaymentBankAccountId: selectedAccountId, idempotencyKey: attempt.key,
        });
      }
      // The acceptance RPC may succeed even if the first response is lost. Confirm
      // the persisted contract before showing a success or enabling further actions.
      const verified = await getLoanDetails(attempt.contractId);
      if (!verified || verified.id !== attempt.contractId) {
        throw new Error("Loan acceptance could not be verified. Retry to check its status.");
      }
      if (activeScopeRef.current !== startingScope) return;
      setAcceptedContractId(attempt.contractId);
      setMessage("Loan accepted. The contract has been verified.");
    } catch (error) {
      if (activeScopeRef.current === startingScope) setAcceptanceError(errorMessage(error));
    } finally {
      if (acceptanceInFlight.current === startingScope) acceptanceInFlight.current = null;
      if (activeScopeRef.current === startingScope) setAcceptancePending(false);
    }
  }

  return (
    <FMPageScaffold title="Apply for banking credit" subtitle="Player loan application, offer review and acceptance." icon={Landmark} backTo="/finance/banking">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>1. Choose product</CardTitle><CardDescription>Band and company borrowing are unavailable in this UI until approval workflows are complete.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Select value={productId} disabled={applicationPending || acceptancePending || !!applicationResult} onValueChange={(value) => { resetApplication(); setProductId(value); setPurpose(products.find((row) => row.id === value)?.allowedPurposes[0] ?? "personal_emergency"); }}>{/* product */}<SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent>{products.map((row) => <SelectItem key={row.id} value={row.id}>{row.providerName} — {row.productName}</SelectItem>)}</SelectContent></Select>
            {product && <div className="rounded-md border p-3 text-sm"><p>Limits: {formatCurrencyMinor(product.minimumAmountMinor, product.supportedCurrencies[0])}–{formatCurrencyMinor(product.maximumAmountMinor, product.supportedCurrencies[0])}</p><p>Terms: {product.minimumTermMonths}–{product.maximumTermMonths} months · Rate {product.interestRateBps / 100}%</p><p>Origination fee: {product.originationFeeBps / 100}% + {formatCurrencyMinor(product.originationFeeFlatMinor, product.supportedCurrencies[0])}</p></div>}
            <Label>Purpose</Label><Select value={purpose} disabled={applicationPending || acceptancePending || !!applicationResult} onValueChange={(value) => { resetApplication(); setPurpose(value); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(product?.allowedPurposes ?? []).map((p) => <SelectItem key={p} value={p}>{p.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select>
            <Label>Amount (minor units)</Label><Input type="number" min={product?.minimumAmountMinor} max={product?.maximumAmountMinor} step={1} disabled={applicationPending || acceptancePending || !!applicationResult} value={amount} onChange={(event) => { resetApplication(); setAmount(Number(event.target.value)); }} />
            <Label>Term months</Label><Input type="number" min={product?.minimumTermMonths} max={product?.maximumTermMonths} step={1} disabled={applicationPending || acceptancePending || !!applicationResult} value={term} onChange={(event) => { resetApplication(); setTerm(Number(event.target.value)); }} />
            {!validApplication && !!product && (
              <p className="text-xs text-muted-foreground">Choose a permitted loan amount, term and purpose for this character.</p>
            )}
            {applicationError && <p role="alert" className="text-sm text-destructive">{applicationError}</p>}
            <Button onClick={() => void submitApplication()} disabled={!validApplication || catalogueLoading || profileLoading || applicationPending || acceptancePending || !!applicationResult}>
              {applicationPending ? "Submitting..." : applicationError ? "Retry application" : applicationResult ? "Application submitted" : "Submit application"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>2. Estimate and offer</CardTitle><CardDescription>Equal-principal estimate until underwriting returns a firm offer.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>First: {formatCurrencyMinor(schedule[0]?.totalDueMinor ?? 0, product?.supportedCurrencies[0] ?? "USD")}</p><p>Middle: {formatCurrencyMinor(schedule[Math.floor(schedule.length / 2)]?.totalDueMinor ?? 0, product?.supportedCurrencies[0] ?? "USD")}</p><p>Final: {formatCurrencyMinor(schedule.at(-1)?.totalDueMinor ?? 0, product?.supportedCurrencies[0] ?? "USD")}</p>
            {offer && <div className="rounded-md border p-3"><p>Decision: {applicationResult.status}</p><p>Offer: {formatCurrencyMinor(offer.principalMinor, offer.currencyCode)} at {offer.interestRateBps / 100}%</p><p>Fee: {formatCurrencyMinor(offer.originationFeeMinor, offer.currencyCode)}</p><Select value={selectedAccountId} disabled={acceptancePending || !!acceptedContractId} onValueChange={(value) => { acceptanceAttempt.current = null; setAcceptanceError(undefined); setSelectedAccountId(value); }}><SelectTrigger><SelectValue placeholder="Select disbursement and repayment account" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.providerName} {account.accountType} — {formatCurrencyMinor(account.balanceMinor, account.currencyCode)}</SelectItem>)}</SelectContent></Select>{acceptanceError && <p role="alert" className="text-destructive">{acceptanceError}</p>}
              <Button className="mt-3" onClick={() => void acceptOffer()}
                disabled={acceptancePending || applicationPending || !!acceptedContractId || !selectedAccountId || !accounts.some((account) => account.id === selectedAccountId && account.status === "active")}>
                {acceptancePending ? "Confirming..." : acceptedContractId ? "Loan accepted" : acceptanceError ? "Retry offer acceptance" : "Confirm and accept offer"}
              </Button>
              {acceptedContractId && <Button asChild variant="outline" className="ml-2"><Link to={`/finance/banking/loans/${acceptedContractId}`}>View loan</Link></Button>}</div>}
            {catalogueLoading && <p role="status" className="text-muted-foreground">Loading loan products and bank accounts...</p>}
            {message && <p role="status" className="text-muted-foreground">{message}</p>}
          </CardContent>
        </Card>
      </div>
    </FMPageScaffold>
  );
}
