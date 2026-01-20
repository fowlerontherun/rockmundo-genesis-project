import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, Zap, Building2, Radio, Users, Sparkles, Loader2 } from "lucide-react";
import { useVipStatus } from "@/hooks/useVipStatus";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface VipTier {
  name: string;
  price: number;
  priceId: string;
  productId: string;
  period: string;
  savings: string | null;
  monthlyEquivalent?: number;
  popular?: boolean;
}

const VIP_TIERS: Record<string, VipTier> = {
  monthly: {
    name: "Monthly",
    price: 4.99,
    priceId: "price_1SrfSyGWxwyLFaDWq7Syz1cG",
    productId: "prod_TpK76xnO7AbZ6S",
    period: "per month",
    savings: null,
  },
  quarterly: {
    name: "Quarterly", 
    price: 12.49,
    priceId: "price_1SrfTQGWxwyLFaDWHpBsIiEd",
    productId: "prod_TpK732QeJJ9Xcw",
    period: "every 3 months",
    savings: "17% off",
    monthlyEquivalent: 4.16,
  },
  annual: {
    name: "Annual",
    price: 39.99,
    priceId: "price_1SrfTkGWxwyLFaDWzNK3a7Sy",
    productId: "prod_TpK8RRreg1hI3l",
    period: "per year",
    savings: "33% off",
    monthlyEquivalent: 3.33,
    popular: true,
  },
};

const VIP_FEATURES = [
  { icon: Building2, title: "Business Empire", description: "Create and manage holding companies, record labels, venues, and more" },
  { icon: Radio, title: "Radio Voting", description: "Vote on song rankings and influence the charts" },
  { icon: Users, title: "Hire Employees", description: "Build teams for your businesses with managers, guards, and staff" },
  { icon: Sparkles, title: "Exclusive Features", description: "Access VIP-only content, chat channels, and events" },
];

export default function VipSubscribe() {
  const { data: vipStatus, isLoading } = useVipStatus();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSubscribe = async (tierId: keyof typeof VIP_TIERS) => {
    setLoadingTier(tierId);
    
    try {
      const tier = VIP_TIERS[tierId];
      
      const { data, error } = await supabase.functions.invoke('create-vip-checkout', {
        body: { priceId: tier.priceId },
      });

      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast({
        title: "Checkout Error",
        description: err.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingTier(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoadingTier('manage');
    
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      console.error('Portal error:', err);
      toast({
        title: "Portal Error",
        description: err.message || "Failed to open billing portal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingTier(null);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30">
          <Crown className="h-5 w-5 text-amber-500" />
          <span className="font-semibold text-amber-400">VIP Membership</span>
        </div>
        
        <h1 className="text-3xl md:text-4xl font-bold">
          Build Your Music Empire
        </h1>
        
        <p className="text-muted-foreground max-w-xl mx-auto">
          Unlock the full power of your music career. Create companies, own venues, 
          influence radio charts, and dominate the industry.
        </p>
      </div>

      {/* Current Status Banner (for VIP users) */}
      {vipStatus?.isVip && (
        <Card className="bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border-amber-500/30">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Crown className="h-10 w-10 text-amber-500" />
                <div>
                  <h3 className="font-semibold text-lg text-amber-400">
                    You're a VIP Member!
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {vipStatus.daysRemaining} days remaining • 
                    Expires {vipStatus.expiresAt && format(vipStatus.expiresAt, 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleManageSubscription}
                variant="outline"
                className="border-amber-500/30 hover:bg-amber-500/10"
                disabled={loadingTier === 'manage'}
              >
                {loadingTier === 'manage' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Manage Subscription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pricing Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {Object.entries(VIP_TIERS).map(([tierId, tier]) => (
          <Card 
            key={tierId}
            className={`relative ${tier.popular 
              ? 'border-amber-500 bg-gradient-to-br from-amber-500/10 via-background to-background shadow-lg shadow-amber-500/10' 
              : 'border-border'
            }`}
          >
            {tier.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black">
                Most Popular
              </Badge>
            )}
            
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">{tier.name}</CardTitle>
              {tier.savings && (
                <Badge variant="outline" className="w-fit mx-auto text-green-500 border-green-500/30">
                  {tier.savings}
                </Badge>
              )}
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="text-center">
                <span className="text-4xl font-bold">${tier.price}</span>
                <span className="text-muted-foreground"> {tier.period}</span>
                {'monthlyEquivalent' in tier && tier.monthlyEquivalent && (
                  <p className="text-sm text-muted-foreground mt-1">
                    ${tier.monthlyEquivalent.toFixed(2)}/month
                  </p>
                )}
              </div>

              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>All VIP features included</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Create unlimited companies</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Radio voting access</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Priority support</span>
                </li>
              </ul>

              <Button
                onClick={() => handleSubscribe(tierId)}
                disabled={loadingTier !== null}
                className={`w-full ${tier.popular 
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black' 
                  : ''
                }`}
                variant={tier.popular ? "default" : "outline"}
              >
                {loadingTier === tierId ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                {vipStatus?.isVip ? 'Switch Plan' : 'Subscribe Now'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Features Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center">What's Included</h2>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {VIP_FEATURES.map((feature, i) => (
            <Card key={i} className="bg-card/50">
              <CardContent className="p-4 space-y-2">
                <feature.icon className="h-8 w-8 text-amber-500" />
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="space-y-4 max-w-2xl mx-auto">
        <h2 className="text-xl font-bold text-center">Frequently Asked Questions</h2>
        
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <h4 className="font-medium">Can I cancel anytime?</h4>
              <p className="text-sm text-muted-foreground">
                Yes! You can cancel your subscription at any time. You'll keep VIP access until your current period ends.
              </p>
            </div>
            <div>
              <h4 className="font-medium">What payment methods do you accept?</h4>
              <p className="text-sm text-muted-foreground">
                We accept all major credit cards, debit cards, and various local payment methods through Stripe.
              </p>
            </div>
            <div>
              <h4 className="font-medium">Will my subscription auto-renew?</h4>
              <p className="text-sm text-muted-foreground">
                Yes, subscriptions renew automatically. You can manage or cancel via the billing portal.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Back Button */}
      <div className="text-center">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          ← Back to Game
        </Button>
      </div>
    </div>
  );
}
