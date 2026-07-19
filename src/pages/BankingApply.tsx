import { useEffect, useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { acceptLoanOffer, createLoanApplication, estimateEqualPrincipalSchedule, formatCurrencyMinor, getLoanApplicationResult, listEligibleLoanProducts, listPlayerBankAccounts, type BankingProduct, type PlayerBankAccount } from "@/services/banking/bankingService";

export default function BankingApply() {
  const [products, setProducts] = useState<BankingProduct[]>([]);
  const [accounts, setAccounts] = useState<PlayerBankAccount[]>([]);
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState(50000);
  const [term, setTerm] = useState(6);
  const [purpose, setPurpose] = useState("personal_emergency");
  const [applicationResult, setApplicationResult] = useState<any>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    void Promise.all([listEligibleLoanProducts(), listPlayerBankAccounts()]).then(([productRows, accountRows]) => {
      setProducts(productRows);
      setAccounts(accountRows);
      setProductId(productRows[0]?.id ?? "");
      setSelectedAccountId(accountRows[0]?.id ?? "");
      setPurpose(productRows[0]?.allowedPurposes?.[0] ?? "personal_emergency");
    }).catch((error) => setMessage(error.message));
  }, []);

  const product = products.find((row) => row.id === productId);
  const schedule = useMemo(() => product ? estimateEqualPrincipalSchedule({ principalMinor: amount, interestRateBps: product.interestRateBps, termMonths: term }) : [], [amount, product, term]);
  const offer = applicationResult?.offer;

  async function submitApplication() {
    if (!product) return;
    const profileId = localStorage.getItem("activeProfileId") ?? "00000000-0000-0000-0000-000000000000";
    const applicationId = await createLoanApplication({ borrowerType: "player", borrowerId: profileId, productId: product.id, requestedAmountMinor: amount, requestedTermMonths: term, purpose, expectedUse: "Player starter loan", idempotencyKey: `ui-${crypto.randomUUID()}` });
    setApplicationResult(await getLoanApplicationResult(applicationId));
  }

  async function acceptOffer() {
    if (!offer?.id || !selectedAccountId) return;
    const contractId = await acceptLoanOffer({ offerId: offer.id, disbursementBankAccountId: selectedAccountId, repaymentBankAccountId: selectedAccountId, idempotencyKey: `ui-accept-${crypto.randomUUID()}` });
    setMessage(`Loan accepted. Contract ${contractId}`);
  }

  return (
    <FMPageScaffold title="Apply for banking credit" subtitle="Player loan application, offer review and acceptance." icon={Landmark} backTo="/finance/banking">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>1. Choose product</CardTitle><CardDescription>Band and company borrowing are unavailable in this UI until approval workflows are complete.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Select value={productId} onValueChange={setProductId}>{/* product */}<SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent>{products.map((row) => <SelectItem key={row.id} value={row.id}>{row.providerName} — {row.productName}</SelectItem>)}</SelectContent></Select>
            {product && <div className="rounded-md border p-3 text-sm"><p>Limits: {formatCurrencyMinor(product.minimumAmountMinor, product.supportedCurrencies[0])}–{formatCurrencyMinor(product.maximumAmountMinor, product.supportedCurrencies[0])}</p><p>Terms: {product.minimumTermMonths}–{product.maximumTermMonths} months · Rate {product.interestRateBps / 100}%</p><p>Origination fee: {product.originationFeeBps / 100}% + {formatCurrencyMinor(product.originationFeeFlatMinor, product.supportedCurrencies[0])}</p></div>}
            <Label>Purpose</Label><Select value={purpose} onValueChange={setPurpose}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(product?.allowedPurposes ?? []).map((p) => <SelectItem key={p} value={p}>{p.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select>
            <Label>Amount (minor units)</Label><Input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
            <Label>Term months</Label><Input type="number" value={term} onChange={(event) => setTerm(Number(event.target.value))} />
            <Button onClick={submitApplication} disabled={!product}>Submit application</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>2. Estimate and offer</CardTitle><CardDescription>Equal-principal estimate until underwriting returns a firm offer.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>First: {formatCurrencyMinor(schedule[0]?.totalDueMinor ?? 0, product?.supportedCurrencies[0] ?? "USD")}</p><p>Middle: {formatCurrencyMinor(schedule[Math.floor(schedule.length / 2)]?.totalDueMinor ?? 0, product?.supportedCurrencies[0] ?? "USD")}</p><p>Final: {formatCurrencyMinor(schedule.at(-1)?.totalDueMinor ?? 0, product?.supportedCurrencies[0] ?? "USD")}</p>
            {offer && <div className="rounded-md border p-3"><p>Decision: {applicationResult.status}</p><p>Offer: {formatCurrencyMinor(offer.principalMinor, offer.currencyCode)} at {offer.interestRateBps / 100}%</p><p>Fee: {formatCurrencyMinor(offer.originationFeeMinor, offer.currencyCode)}</p><Select value={selectedAccountId} onValueChange={setSelectedAccountId}><SelectTrigger><SelectValue placeholder="Select disbursement and repayment account" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.providerName} {account.accountType} — {formatCurrencyMinor(account.balanceMinor, account.currencyCode)}</SelectItem>)}</SelectContent></Select><Button className="mt-3" onClick={acceptOffer}>Confirm and accept offer</Button></div>}
            {message && <p className="text-muted-foreground">{message}</p>}
          </CardContent>
        </Card>
      </div>
    </FMPageScaffold>
  );
}
