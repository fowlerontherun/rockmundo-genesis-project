import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, CheckCircle, Loader2, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useVipStatus } from "@/hooks/useVipStatus";
import { supabase } from "@/integrations/supabase/client";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

export default function VipSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { userId } = useActiveProfile();
  const { data: vipStatus, refetch: refetchVip } = useVipStatus();
  const [receiptVerified, setReceiptVerified] = useState(false);
  const [receiptError, setReceiptError] = useState(false);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (!userId || !sessionId) {
      setReceiptError(true);
      return;
    }
    let cancelled = false;
    void supabase.functions.invoke("get-checkout-receipt", { body: { sessionId } })
      .then(({ data, error }) => {
        if (cancelled) return;
        const receipt = data?.receipt;
        if (error || !receipt || receipt.session_id !== sessionId || receipt.status !== "complete" || !["paid", "no_payment_required"].includes(receipt.payment_status)) {
          setReceiptError(true);
          return;
        }
        setReceiptVerified(true);
        void queryClient.invalidateQueries({ queryKey: ["vip-status", userId] });
        void refetchVip();
      })
      .catch(() => { if (!cancelled) setReceiptError(true); });
    return () => { cancelled = true; };
  }, [sessionId, userId, queryClient, refetchVip]);

  const activated = receiptVerified && vipStatus?.isVip === true;

  return (
    <FMPageScaffold title={activated ? "VIP Membership Activated" : "VIP Checkout Status"} icon={Crown} backTo="/hub/premium-store">
      <div className="flex items-center justify-center min-h-[600px]">
      <Card className="max-w-md w-full bg-gradient-to-br from-amber-500/10 via-background to-background border-amber-500/30">
        <CardContent className="p-8 text-center space-y-6">
          {/* Checkout confirmation */}
          <div className="relative mx-auto w-fit">
            {activated && <div className="absolute inset-0 animate-ping rounded-full bg-green-500/30" />}
            <div className="relative rounded-full bg-green-500/20 p-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
          </div>

          {/* VIP Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-amber-900">
            <Crown className="h-5 w-5" />
            <span className="font-bold">VIP</span>
            <Sparkles className="h-4 w-4" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{activated ? "Welcome to VIP!" : receiptError ? "Unable to verify checkout" : "Confirming VIP subscription"}</h1>
            <p className="text-muted-foreground">
              {activated ? "Your subscription is active and VIP access is ready." : receiptError ? "We could not verify this checkout. Please check your receipt or contact support." : "Your payment and VIP entitlement are being verified. Access will appear after confirmation."}
            </p>
          </div>

          {activated && <div className="space-y-3 text-left bg-muted/30 rounded-lg p-4">
            <h3 className="font-semibold text-sm">You can now:</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                Create companies, labels, venues & studios
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                Record songs, release music & earn royalties
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                Vote on radio charts & influence rankings
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                Tour worldwide & build city-by-city fame
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                Hire crew, run PR & sell merchandise
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                VIP gig audio, awards & exclusive chat
              </li>
            </ul>
          </div>}

          <div className="space-y-2">
            <Button 
              onClick={() => navigate("/home")}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
            >
              <Crown className="h-4 w-4 mr-2" />
              Start Building Your Empire
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate(`/checkout-receipt${sessionId ? `?session_id=${sessionId}` : ""}`)}
            >
              View receipt & subscription status
            </Button>
            

          </div>
        </CardContent>
      </Card>
      </div>
    </FMPageScaffold>
  );
}
