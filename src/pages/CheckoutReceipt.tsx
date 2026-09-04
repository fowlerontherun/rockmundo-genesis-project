import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Crown, Heart, Receipt, Users, ExternalLink, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVipStatus } from "@/hooks/useVipStatus";
import { useCharacterSlots } from "@/hooks/useCharacterSlots";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { useToast } from "@/hooks/use-toast";

interface ReceiptLineItem {
  description: string;
  quantity: number;
  amount_total: number;
  currency: string;
  price_id: string | null;
  interval: string | null;
  interval_count: number | null;
}

interface ReceiptData {
  session_id: string;
  mode: string;
  purchase_type: string;
  payment_status: string;
  status: string;
  amount_total: number;
  currency: string;
  created: number;
  customer_email: string | null;
  metadata: Record<string, string>;
  line_items: ReceiptLineItem[];
  receipt_url: string | null;
  subscription: {
    id: string;
    status: string;
    cancel_at_period_end: boolean;
    current_period_end: number | null;
  } | null;
}

interface CurrentSubscription {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  interval_count: number | null;
  price_id: string | null;
}

const formatMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);

const formatDate = (seconds: number | null) =>
  seconds ? new Date(seconds * 1000).toLocaleString() : "—";

const purchaseMeta = (type: string, mode: string) => {
  const key = (type || mode || "").toLowerCase();
  if (key.includes("vip") || mode === "subscription") {
    return { label: "VIP membership", icon: Crown, tone: "text-amber-500" };
  }
  if (key.includes("donation")) {
    return { label: "Donation", icon: Heart, tone: "text-pink-500" };
  }
  if (key.includes("slot") || key.includes("character")) {
    return { label: "Character slot", icon: Users, tone: "text-sky-500" };
  }
  return { label: "Purchase", icon: Receipt, tone: "text-primary" };
};

export default function CheckoutReceipt() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { toast } = useToast();

  const { data: vipStatus, refetch: refetchVip } = useVipStatus();
  const { slots } = useCharacterSlots();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("get-checkout-receipt", {
        body: { sessionId },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setReceipt((data?.receipt as ReceiptData) ?? null);
      setCurrentSubscription((data?.currentSubscription as CurrentSubscription) ?? null);
      void refetchVip();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your receipt.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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

  const meta = useMemo(
    () => purchaseMeta(receipt?.purchase_type ?? "", receipt?.mode ?? ""),
    [receipt?.purchase_type, receipt?.mode],
  );
  const PurchaseIcon = meta.icon;

  const paid = receipt?.payment_status === "paid" || receipt?.payment_status === "no_payment_required";

  return (
    <FMPageScaffold title="Receipt & subscription status" icon={Receipt} backTo="/shop">
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Could not load receipt</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{error}</p>
              <Button size="sm" variant="outline" onClick={() => void load()} className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : receipt ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PurchaseIcon className={`h-4 w-4 ${meta.tone}`} /> {meta.label}
                </CardTitle>
                <Badge variant={paid ? "default" : "secondary"} className="gap-1">
                  {paid && <CheckCircle2 className="h-3 w-3" />}
                  {paid ? "Paid" : receipt.payment_status}
                </Badge>
              </div>
              <CardDescription>
                {formatDate(receipt.created)} · {receipt.customer_email ?? "your account"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {receipt.line_items.map((item, index) => (
                  <div key={`${item.price_id ?? "item"}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <div className="font-medium">{item.description}</div>
                      <div className="text-xs text-muted-foreground">
                        Qty {item.quantity}
                        {item.interval
                          ? ` · billed every ${item.interval_count && item.interval_count > 1 ? `${item.interval_count} ${item.interval}s` : item.interval}`
                          : ""}
                      </div>
                    </div>
                    <div className="whitespace-nowrap font-semibold">
                      {formatMoney(item.amount_total, item.currency)}
                    </div>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Total paid</span>
                <span>{formatMoney(receipt.amount_total, receipt.currency)}</span>
              </div>
              <div className="text-xs text-muted-foreground">Order reference: {receipt.session_id}</div>
              <div className="flex flex-wrap gap-2 pt-1">
                {receipt.receipt_url && (
                  <Button size="sm" variant="outline" asChild className="gap-2">
                    <a href={receipt.receipt_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Stripe receipt
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => void load()} className="gap-2">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">No purchase selected</CardTitle>
              <CardDescription>
                Open this page from a checkout confirmation to see the itemised receipt. Your current subscription state is shown below.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4 text-amber-500" /> Subscription status
            </CardTitle>
            <CardDescription>Your live VIP and entitlement state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">VIP</span>
              <Badge variant={vipStatus?.isVip ? "default" : "secondary"}>
                {vipStatus?.isVip ? `Active${vipStatus.subscriptionType ? ` · ${vipStatus.subscriptionType}` : ""}` : "Not active"}
              </Badge>
            </div>
            {vipStatus?.expiresAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Renews / expires</span>
                <span>
                  {vipStatus.expiresAt.toLocaleDateString()}
                  {typeof vipStatus.daysRemaining === "number" ? ` (${vipStatus.daysRemaining} days left)` : ""}
                </span>
              </div>
            )}
            {currentSubscription && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Stripe subscription</span>
                  <Badge variant="outline">{currentSubscription.status}</Badge>
                </div>
                {currentSubscription.amount !== null && currentSubscription.currency && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Billing</span>
                    <span>
                      {formatMoney(currentSubscription.amount, currentSubscription.currency)}
                      {currentSubscription.interval ? ` / ${currentSubscription.interval}` : ""}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {currentSubscription.cancel_at_period_end ? "Ends on" : "Next payment"}
                  </span>
                  <span>{formatDate(currentSubscription.current_period_end)}</span>
                </div>
              </>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Character slots</span>
              <span>
                {slots ? `${slots.usedSlots ?? 0} of ${slots.maxSlots ?? 2} used` : "—"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={() => void openPortal()} disabled={portalLoading} className="gap-2">
                <ExternalLink className="h-3.5 w-3.5" /> Manage billing
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/subscription")}>
                Subscription status
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/shop")}>
                Back to Shop
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate("/home")}>
                Continue playing
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </FMPageScaffold>
  );
}
