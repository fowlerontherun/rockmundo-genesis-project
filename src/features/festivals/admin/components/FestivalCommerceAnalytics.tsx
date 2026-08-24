import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, BarChart3, Store, Ticket, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useFestivalCommerceAnalytics,
  useSaveFestivalTicketPricingRule,
  useSaveFestivalVendorAssignment,
} from "../commerceB6";

const numberValue = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const requestKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const money = (minor: number, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format((minor ?? 0) / 100);

export function FestivalCommerceAnalytics({ editionId }: { editionId: string }) {
  const analytics = useFestivalCommerceAnalytics(editionId);
  const pricingMutation = useSaveFestivalTicketPricingRule(editionId);
  const vendorMutation = useSaveFestivalVendorAssignment(editionId);
  const data = analytics.data;

  const products = data?.tickets?.products ?? [];
  const stalls = data?.vendors?.stalls ?? [];
  const currency = data?.settlement?.currencyCode ?? stalls[0]?.currencyCode ?? "USD";
  const [selectedProductId, setSelectedProductId] = useState("");
  const [ruleName, setRuleName] = useState("Demand pricing");
  const [fromPercent, setFromPercent] = useState("70");
  const [toPercent, setToPercent] = useState("100");
  const [adjustPercent, setAdjustPercent] = useState("10");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [priority, setPriority] = useState("100");

  const [stallName, setStallName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorCategory, setVendorCategory] = useState<
    "food" | "soft_drinks" | "alcohol_where_game_rules_allow" | "festival_merch"
  >("food");
  const [vendorOwnerType, setVendorOwnerType] = useState<"player" | "band" | "company">("company");
  const [vendorOwnerId, setVendorOwnerId] = useState("");
  const [vendorSharePercent, setVendorSharePercent] = useState("20");
  const [shareBase, setShareBase] = useState<"gross" | "gross_after_tax">("gross_after_tax");

  useEffect(() => {
    if (!selectedProductId && products[0]) setSelectedProductId(products[0].id);
  }, [products, selectedProductId]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId],
  );

  useEffect(() => {
    if (!selectedProduct) return;
    if (!minPrice) setMinPrice((selectedProduct.basePriceMinor / 100).toFixed(2));
    if (!maxPrice) setMaxPrice(((selectedProduct.basePriceMinor * 1.5) / 100).toFixed(2));
  }, [selectedProduct, minPrice, maxPrice]);

  if (analytics.isLoading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Loading canonical ticket, vendor and festival analytics…
        </CardContent>
      </Card>
    );
  }
  if (analytics.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Festival commerce analytics unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {analytics.error instanceof Error
              ? analytics.error.message
              : "The canonical commerce projection could not be loaded."}
          </p>
          <Button size="sm" variant="outline" onClick={() => analytics.refetch()}>
            Retry analytics
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!data?.linked) {
    return (
      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Commerce link needs admin repair
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This edition has no unambiguous link to the launch/runtime commerce stack. Ticket,
            vendor and Finance figures are hidden rather than guessed.
          </p>
        </CardContent>
      </Card>
    );
  }

  const reconciliation = data.reconciliation;
  const pricingError = pricingMutation.error instanceof Error ? pricingMutation.error.message : null;
  const vendorError = vendorMutation.error instanceof Error ? vendorMutation.error.message : null;

  const savePricing = () => {
    if (!data.festivalLaunchId || !selectedProduct) return;
    const existing = selectedProduct.rules.find(
      (rule) => rule.name.trim().toLowerCase() === ruleName.trim().toLowerCase(),
    );
    pricingMutation.mutate({
      festivalLaunchId: data.festivalLaunchId,
      ticketProductId: selectedProduct.id,
      ruleName: ruleName.trim(),
      minSellThroughBasisPoints: Math.round(numberValue(fromPercent) * 100),
      maxSellThroughBasisPoints: Math.round(numberValue(toPercent, 100) * 100),
      adjustmentBasisPoints: Math.round(numberValue(adjustPercent) * 100),
      minPriceMinor: Math.round(numberValue(minPrice) * 100),
      maxPriceMinor: Math.round(numberValue(maxPrice) * 100),
      priority: Math.round(numberValue(priority, 100)),
      active: true,
      expectedVersion: existing?.version ?? 0,
      idempotencyKey: requestKey(),
    });
  };

  const saveVendor = () => {
    if (!data.festivalLaunchId || !stallName.trim() || !vendorName.trim() || !vendorOwnerId.trim())
      return;
    const existing = stalls.find(
      (stall) => stall.stallName.trim().toLowerCase() === stallName.trim().toLowerCase(),
    );
    vendorMutation.mutate({
      festivalLaunchId: data.festivalLaunchId,
      stallName: stallName.trim(),
      category: vendorCategory,
      vendorName: vendorName.trim(),
      vendorOwnerType,
      vendorOwnerId: vendorOwnerId.trim(),
      revenueShareBasisPoints: Math.round(numberValue(vendorSharePercent) * 100),
      shareBase,
      expectedVersion: existing?.version ?? 0,
      idempotencyKey: requestKey(),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Ticket, vendor & operational analytics</h3>
          <p className="text-sm text-muted-foreground">
            Canonical launch, runtime, settlement and Finance evidence for this edition.
          </p>
        </div>
        <Badge variant={reconciliation.balanced ? "default" : "destructive"}>
          {reconciliation.balanced
            ? "Reconciled"
            : `${reconciliation.codes.length} reconciliation issue${reconciliation.codes.length === 1 ? "" : "s"}`}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="Tickets"
          icon={Ticket}
          value={`${data.tickets?.sold ?? 0} / ${data.tickets?.capacity ?? 0}`}
          detail={`${data.tickets?.remaining ?? 0} remaining · ${((data.tickets?.sellThroughBasisPoints ?? 0) / 100).toFixed(1)}% sell-through`}
        />
        <Metric
          title="Ticket cash"
          icon={BarChart3}
          value={money(data.tickets?.netCashMinor ?? 0, currency)}
          detail={`${money(data.tickets?.financePostedMinor ?? 0, currency)} posted through Finance`}
        />
        <Metric
          title="Attendance"
          icon={Users}
          value={(data.attendance?.uniqueAttendees ?? 0).toLocaleString()}
          detail={`${(data.attendance?.peakOnsite ?? 0).toLocaleString()} peak onsite · ${data.satisfaction?.averageScore ?? "—"} satisfaction`}
        />
        <Metric
          title="Vendor shares"
          icon={Store}
          value={money(data.vendors?.sharePayableMinor ?? 0, currency)}
          detail={`${money(data.vendors?.sharePaidMinor ?? 0, currency)} paid · ${money(data.vendors?.shareOutstandingMinor ?? 0, currency)} outstanding`}
        />
      </div>

      {!reconciliation.balanced && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base">Reconciliation needs attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reconciliation.codes.map((code) => (
              <p key={code} className="text-sm font-mono">
                {code}
              </p>
            ))}
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <span>Ticket sales: {money(reconciliation.ticketSalesMinor ?? 0, currency)}</span>
              <span>Ticket Finance: {money(reconciliation.ticketFinanceMinor ?? 0, currency)}</span>
              <span>Vendor sales: {money(reconciliation.vendorSalesMinor ?? 0, currency)}</span>
              <span>Vendor postings: {money(reconciliation.vendorPostingsMinor ?? 0, currency)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ticket tiers & dynamic pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Tier</th>
                  <th>Base</th>
                  <th>Current</th>
                  <th>Sold</th>
                  <th>Remaining</th>
                  <th>Rules</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{product.name}</td>
                    <td>{money(product.basePriceMinor, currency)}</td>
                    <td>{money(product.effectivePriceMinor, currency)}</td>
                    <td>{product.sold}</td>
                    <td>{product.remaining}</td>
                    <td>{product.rules.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {products.length > 0 && (
            <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-4">
              <Field label="Ticket tier">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={selectedProductId}
                  onChange={(event) => {
                    setSelectedProductId(event.target.value);
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rule name">
                <Input value={ruleName} onChange={(event) => setRuleName(event.target.value)} />
              </Field>
              <Field label="Sell-through from %">
                <Input inputMode="decimal" value={fromPercent} onChange={(event) => setFromPercent(event.target.value)} />
              </Field>
              <Field label="Sell-through to %">
                <Input inputMode="decimal" value={toPercent} onChange={(event) => setToPercent(event.target.value)} />
              </Field>
              <Field label="Price adjustment %">
                <Input inputMode="decimal" value={adjustPercent} onChange={(event) => setAdjustPercent(event.target.value)} />
              </Field>
              <Field label={`Minimum price (${currency})`}>
                <Input inputMode="decimal" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
              </Field>
              <Field label={`Maximum price (${currency})`}>
                <Input inputMode="decimal" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
              </Field>
              <Field label="Priority">
                <Input inputMode="numeric" value={priority} onChange={(event) => setPriority(event.target.value)} />
              </Field>
              <div className="md:col-span-4 flex items-center gap-3">
                <Button onClick={savePricing} disabled={pricingMutation.isPending || !ruleName.trim()}>
                  {pricingMutation.isPending ? "Saving…" : "Save pricing rule"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  The server recalculates the effective price before each canonical purchase; the
                  browser never supplies the checkout price.
                </p>
              </div>
              {pricingError && <p className="md:col-span-4 text-sm text-destructive">{pricingError}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendor stalls & revenue shares</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            {stalls.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No external vendor stalls configured. Unassigned runtime sales remain festival-operated.
              </p>
            ) : (
              stalls.map((stall) => (
                <div
                  key={stall.id}
                  className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {stall.stallName} · {stall.vendorName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stall.category.replaceAll("_", " ")} · {(stall.revenueShareBasisPoints / 100).toFixed(1)}%
                      of {stall.shareBase.replaceAll("_", " ")}
                    </p>
                  </div>
                  <Badge variant="outline">{stall.vendorOwnerType}</Badge>
                </div>
              ))
            )}
          </div>
          <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-4">
            <Field label="Stall name">
              <Input value={stallName} onChange={(event) => setStallName(event.target.value)} placeholder="North Field Burgers" />
            </Field>
            <Field label="Vendor name">
              <Input value={vendorName} onChange={(event) => setVendorName(event.target.value)} placeholder="Vendor display name" />
            </Field>
            <Field label="Category">
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={vendorCategory}
                onChange={(event) => setVendorCategory(event.target.value as typeof vendorCategory)}
              >
                <option value="food">Food</option>
                <option value="soft_drinks">Soft drinks</option>
                <option value="alcohol_where_game_rules_allow">Bar</option>
                <option value="festival_merch">Festival merch</option>
              </select>
            </Field>
            <Field label="Recipient type">
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={vendorOwnerType}
                onChange={(event) => setVendorOwnerType(event.target.value as typeof vendorOwnerType)}
              >
                <option value="company">Company</option>
                <option value="player">Player</option>
                <option value="band">Band</option>
              </select>
            </Field>
            <Field label="Recipient ID">
              <Input value={vendorOwnerId} onChange={(event) => setVendorOwnerId(event.target.value)} placeholder="Canonical UUID" />
            </Field>
            <Field label="Revenue share %">
              <Input inputMode="decimal" value={vendorSharePercent} onChange={(event) => setVendorSharePercent(event.target.value)} />
            </Field>
            <Field label="Share basis">
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={shareBase}
                onChange={(event) => setShareBase(event.target.value as typeof shareBase)}
              >
                <option value="gross_after_tax">Gross after tax</option>
                <option value="gross">Gross</option>
              </select>
            </Field>
            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={saveVendor}
                disabled={
                  vendorMutation.isPending || !stallName.trim() || !vendorName.trim() || !vendorOwnerId.trim()
                }
              >
                {vendorMutation.isPending ? "Saving…" : "Save vendor assignment"}
              </Button>
            </div>
            {vendorError && <p className="md:col-span-4 text-sm text-destructive">{vendorError}</p>}
          </div>
          <p className="text-xs text-muted-foreground">
            Closed assigned vendor sales create an immutable share obligation. Phase 9 settlement
            converts it into a payable and Finance executes it once.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operational outcome</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Outcome label="Completed performances" value={String(data.performance?.completedPerformances ?? 0)} />
          <Outcome
            label="Average performance score"
            value={data.performance?.averageScore != null ? data.performance.averageScore.toFixed(1) : "—"}
          />
          <Outcome label="Peak audience" value={(data.performance?.peakAudience ?? 0).toLocaleString()} />
          <Outcome label="Settlement" value={data.settlement?.status?.replaceAll("_", " ") ?? "Not prepared"} />
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  title,
  icon: Icon,
  value,
  detail,
}: {
  title: string;
  icon: typeof Ticket;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-2 text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function Outcome({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold capitalize">{value}</p>
    </div>
  );
}
