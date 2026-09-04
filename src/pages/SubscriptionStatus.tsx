import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  CalendarClock,
  CreditCard,
  Crown,
  ExternalLink,
  FileText,
  Info,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVipStatus } from "@/hooks/useVipStatus";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionInfo {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  canceled_at: number | null;
  ended_at: number | null;
  trial_end: number | null;
  current_period_start: number | null;
  current_period_end: number | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  interval_count: number | null;
  price_id: string | null;
  product_name: string | null;
  payment_method: { brand: string; last4: string; exp_month: number; exp_year: number } | null;
}

interface InvoiceInfo {
  id: string;
  number: string | null;
  status: string | null;
  amount_paid: number;
  amount_due: number;
  currency: string;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

const formatMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);

const formatDate = (seconds: number | null) =>
  seconds
    ? new Date(seconds * 1000).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : "—";

const statusTone = (status: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
  switch (status) {
    case "active":
      return { label: "Active", variant: "default" };
    case "trialing":
      return { label: "Trialing", variant: "default" };
    case "past_due":
      return { label: "Past due", variant: "destructive" };
    case "unpaid":
      return { label: "Unpaid", variant: "destructive" };
    case "canceled":
      return { label: "Canceled", variant: "secondary" };
    case "incomplete":
    case "incomplete_expired":
      return { label: "Incomplete", variant: "destructive" };
    default:
      return { label: status, variant: "outline" };
  }
};

const billingLabel = (sub: SubscriptionInfo) => {
  if (sub.amount === null || !sub.currency) return "—";
  const cadence = sub.interval
    ? sub.interval_count && sub.interval_count > 1
      ? ` every ${sub.interval_count} ${sub.interval}s`
      : ` / ${sub.interval}`
    : "";
  return `${formatMoney(sub.amount, sub.currency)}${cadence}`;
};

export default function SubscriptionStatus() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: vipStatus, refetch: refetchVip } = useVipStatus();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [invoices, setInvoices] = useState<InvoiceInfo[]>([]);
  const [portalLoading, setPortalLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("get-subscription-status");
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error as string);
      setSubscription((data?.subscription as SubscriptionInfo) ?? null);
      setInvoices(Array.isArray(data?.invoices) ? (data.invoices as InvoiceInfo[]) : []);
      void refetchVip();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your subscription details.");
    } finally {
      setLoading(false);
    }
  }, [refetchVip]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("customer-portal");
      if (fnError) throw fnError;
      if (data?.url) window.open(data.url as string, "_blank");
    } catch {
      toast({
        title: "Billing portal unavailable",
        description: "We could not open the Stripe billing portal. Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const cancelling = subscription?.cancel_at_period_end || subscription?.status === "canceled";
  const accessEndsAt = subscription?.ended_at ?? subscription?.cancel_at ?? subscription?.current_period_end ?? null;

  return (
    <FMPageScaffold title="Subscription status" icon={Crown} backTo="/shop">
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-6 w-52" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Could not load subscription</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{error}</p>
              <Button size="sm" variant="outline" onClick={() => void load()} className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Crown className="h-4 w-4 text-amber-500" />
                    {subscription?.product_name ?? "VIP membership"}
                  </CardTitle>
                  <Badge variant={subscription ? statusTone(subscription.status).variant : "secondary"}>
                    {subscription ? statusTone(subscription.status).label : "No subscription"}
                  </Badge>
                </div>
                <CardDescription>
                  {subscription
                    ? "Your live Stripe subscription for this account."
                    : "You do not have an active Stripe subscription on this account."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">In-game VIP access</span>
                  <Badge variant={vipStatus?.isVip ? "default" : "secondary"}>
                    {vipStatus?.isVip
                      ? `Active${vipStatus.subscriptionType ? ` · ${vipStatus.subscriptionType}` : ""}${
                          typeof vipStatus.daysRemaining === "number" ? ` · ${vipStatus.daysRemaining}d left` : ""
                        }`
                      : "Not active"}
                  </Badge>
                </div>

                {subscription ? (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Price</span>
                      <span className="font-medium">{billingLabel(subscription)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Current billing period</span>
                      <span>
                        {formatDate(subscription.current_period_start)} → {formatDate(subscription.current_period_end)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {cancelling ? "Access ends" : "Next payment"}
                      </span>
                      <span className="font-medium">{formatDate(accessEndsAt)}</span>
                    </div>
                    {subscription.trial_end && subscription.status === "trialing" && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Trial ends</span>
                        <span>{formatDate(subscription.trial_end)}</span>
                      </div>
                    )}
                    {subscription.payment_method && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <CreditCard className="h-3.5 w-3.5" /> Payment method
                        </span>
                        <span className="capitalize">
                          {subscription.payment_method.brand} ···· {subscription.payment_method.last4} (exp{" "}
                          {String(subscription.payment_method.exp_month).padStart(2, "0")}/
                          {subscription.payment_method.exp_year})
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">Subscription reference: {subscription.id}</div>
                  </>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-1">
                  {subscription ? (
                    <Button size="sm" onClick={() => void openPortal()} disabled={portalLoading} className="gap-2">
                      <ExternalLink className="h-3.5 w-3.5" /> Manage or cancel billing
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => navigate("/vip-subscribe")} className="gap-2">
                      <Crown className="h-3.5 w-3.5" /> Become VIP
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => void load()} className="gap-2">
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="h-4 w-4 text-primary" />
                  {cancelling ? "What happens now that it's cancelling" : "What happens if you cancel"}
                </CardTitle>
                <CardDescription>
                  {cancelling
                    ? `Your membership will not renew. VIP access stays on until ${formatDate(accessEndsAt)}.`
                    : "Cancelling stops future payments — nothing is charged again after that."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  · You keep full VIP access until the end of the period you have already paid for
                  {accessEndsAt ? ` (${formatDate(accessEndsAt)})` : ""}. Nothing is removed early.
                </p>
                <p>· After that date VIP perks switch off: AI song generation, VIP gig audio, VIP chat and other VIP-only features become unavailable.</p>
                <p>· Your characters, bands, songs, releases, companies, money and progress are all kept — nothing is deleted.</p>
                <p>· Items and character slots you bought outright stay yours forever.</p>
                <p>· You can resubscribe at any time and VIP features come straight back on.</p>
              </CardContent>
            </Card>

            {invoices.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-primary" /> Recent invoices
                  </CardTitle>
                  <CardDescription>Your latest Stripe billing history.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{inv.number ?? inv.id}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(inv.created)} · {inv.status ?? "unknown"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="font-semibold">
                          {formatMoney(inv.amount_paid || inv.amount_due, inv.currency)}
                        </span>
                        {inv.hosted_invoice_url && (
                          <Button size="sm" variant="ghost" asChild className="gap-1">
                            <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </FMPageScaffold>
  );
}
