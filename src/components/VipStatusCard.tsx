import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Crown, Calendar, Clock, CreditCard, Heart, Loader2 } from "lucide-react";
import { useVipStatus } from "@/hooks/useVipStatus";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VipStatusCardProps {
  compact?: boolean;
}

export const VipStatusCard = ({ compact = false }: VipStatusCardProps) => {
  const { data: vipStatus, isLoading } = useVipStatus();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [donating, setDonating] = useState(false);

  const handleDonate = async () => {
    setDonating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-donation");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to start donation process", variant: "destructive" });
    } finally {
      setDonating(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  // If user is VIP
  if (vipStatus?.isVip) {
    const getSubscriptionLabel = () => {
      switch (vipStatus.subscriptionType) {
        case 'trial':
          return 'Free Trial';
        case 'gifted':
          return 'Gift';
        case 'paid':
          return 'Premium';
        default:
          return 'VIP';
      }
    };

    const getSubscriptionColor = () => {
      switch (vipStatus.subscriptionType) {
        case 'trial':
          return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
        case 'gifted':
          return 'bg-purple-500/10 text-purple-500 border-purple-500/30';
        case 'paid':
          return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
        default:
          return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
      }
    };

    // Calculate progress based on 30-day period
    const totalDays = 30;
    const daysUsed = totalDays - (vipStatus.daysRemaining || 0);
    const progressPercent = Math.min(100, Math.max(0, (daysUsed / totalDays) * 100));

    if (compact) {
      return (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30">
          <Crown className="h-5 w-5 text-amber-500" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-amber-400">VIP {getSubscriptionLabel()}</span>
              <Badge variant="outline" className="text-xs text-amber-300 border-amber-500/30">
                {vipStatus.daysRemaining}d left
              </Badge>
            </div>
          </div>
        </div>
      );
    }

    return (
      <Card className="bg-gradient-to-br from-amber-500/10 via-background to-background border-amber-500/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Crown className="h-5 w-5 text-amber-500" />
              VIP Status
            </CardTitle>
            <Badge className={getSubscriptionColor()}>
              {getSubscriptionLabel()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Time Remaining</span>
            </div>
            <span className="text-2xl font-bold text-amber-400">
              {vipStatus.daysRemaining} days
            </span>
          </div>
          
          <Progress value={100 - progressPercent} className="h-2" />
          
          {vipStatus.expiresAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Expires {format(vipStatus.expiresAt, 'MMMM d, yyyy')}</span>
            </div>
          )}

          {(vipStatus.daysRemaining || 0) <= 7 && (
            <Button 
              onClick={() => navigate("/vip-subscribe")}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Renew VIP Now
            </Button>
          )}

          <Button
            onClick={handleDonate}
            disabled={donating}
            variant="outline"
            className="w-full border-pink-500/30 text-pink-500 hover:bg-pink-500/10"
          >
            {donating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Heart className="h-4 w-4 mr-2" />}
            Donate $10 to Project
          </Button>
        </CardContent>
      </Card>
    );
  }

  // If user is NOT VIP - show upgrade prompt
  return (
    <Card className="bg-gradient-to-br from-muted/50 via-background to-background border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Crown className="h-5 w-5 text-muted-foreground" />
          Unlock VIP Features
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Build your business empire, vote on radio charts, and access exclusive features!
        </p>
        
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Create and manage companies</li>
          <li>• Own record labels, venues, studios</li>
          <li>• Vote on radio song rankings</li>
          <li>• Exclusive VIP chat access</li>
        </ul>

        <Button 
          onClick={() => navigate("/vip-subscribe")}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
        >
          <Crown className="h-4 w-4 mr-2" />
          Become VIP - From $4.99/mo
        </Button>

        <Button
          onClick={handleDonate}
          disabled={donating}
          variant="outline"
          className="w-full border-pink-500/30 text-pink-500 hover:bg-pink-500/10"
        >
          {donating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Heart className="h-4 w-4 mr-2" />}
          Donate $10 to Project
        </Button>
      </CardContent>
    </Card>
  );
};
