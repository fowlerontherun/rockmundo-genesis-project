import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingBag, Crown, Heart, UserPlus, Shirt, Package, Sparkles, Check,
  Loader2, Building2, Radio, Music, Mic2, MapPin, Car, Users, Trophy,
  MessageSquare, Store, Shield, Volume2, ArrowRight,
} from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useVipStatus } from "@/hooks/useVipStatus";
import { useCharacterSlots } from "@/hooks/useCharacterSlots";
import { cn } from "@/lib/utils";
import { CurrencySelector } from "@/components/shop/CurrencySelector";
import { useCheckoutCurrency } from "@/hooks/useCheckoutCurrency";
import { CHECKOUT_PRICING, formatMinor, formatProductPrice, type CheckoutProductKey } from "@/lib/checkoutCurrency";

const VIP_PLANS: Array<{
  name: string;
  pricingKey: CheckoutProductKey;
  months: number;
  period: string;
  note: string | null;
}> = [
  { name: "Monthly", pricingKey: "vipMonthly", months: 1, period: "per month", note: null },
  { name: "Quarterly", pricingKey: "vipQuarterly", months: 3, period: "every 3 months", note: "Save 17%" },
  { name: "Annual", pricingKey: "vipAnnual", months: 12, period: "per year", note: "Save 33% — best value" },
];

const VIP_FEATURES = [
  { icon: Building2, title: "Business Empire", description: "Found holding companies, record labels, studios, venues, security firms and merch factories." },
  { icon: Music, title: "Song Recording & Release", description: "Record in studios, release singles and albums, and collect royalties from sales and streams." },
  { icon: Mic2, title: "Live Gig Audio", description: "AI-generated audio plays during gig reviews — a fully immersive VIP-only playback experience." },
  { icon: MapPin, title: "World Touring", description: "Book shows across the globe, tour with your band and grow regional fame city by city." },
  { icon: Car, title: "VIP Gig Concierge", description: "Never miss a booked show — chauffeured limo or private jet travel is arranged automatically." },
  { icon: Users, title: "Hire Employees & Crew", description: "Staff your businesses and hire touring crew: managers, engineers, guards and roadies." },
  { icon: Radio, title: "Radio Chart Voting", description: "Vote on radio rankings and directly influence the in-game music charts." },
  { icon: Heart, title: "Social & Relationships", description: "Deeper relationships — romance, rivalries, band drama and multi-generation family legacies." },
  { icon: Trophy, title: "Awards & Nominations", description: "Become eligible for award shows, walk the red carpet and win prestigious prizes." },
  { icon: MessageSquare, title: "VIP Chat Channels", description: "Exclusive VIP-only chat rooms and community features." },
  { icon: Store, title: "Merchandise & Sales", description: "Design and sell band merch, and manage manufacturing and distribution." },
  { icon: Shield, title: "PR & Media Control", description: "Run press campaigns, manage media appearances and steer your public image." },
  { icon: Volume2, title: "Streaming & Royalties", description: "Distribute to streaming platforms, track daily plays and collect royalty income." },
];

export default function Shop() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: vipStatus } = useVipStatus();
  const { slots } = useCharacterSlots();
  const [donating, setDonating] = useState(false);
  const { currency } = useCheckoutCurrency();
  const donationPrice = formatProductPrice("donation", currency);
  const cheapestMonthly = formatMinor(
    Math.round(CHECKOUT_PRICING.vipAnnual[currency] / 12),
    currency,
  );

  const maxSlots = slots?.maxSlots ?? 2;

  const handleDonate = async () => {
    setDonating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-donation", { body: { currency } });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch {
      toast({ title: "Error", description: "Failed to start the donation checkout.", variant: "destructive" });
    } finally {
      setDonating(false);
    }
  };

  return (
    <FMPageScaffold
      title="Shop"
      eyebrow="Support Rockmundo"
      subtitle="VIP membership, extra characters, cosmetics and project donations — all in one place."
      icon={ShoppingBag}
    >
      {/* Hero */}
      <Card className="relative overflow-hidden border-primary/40">
        <div
          className="absolute inset-0 opacity-90"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.22), hsl(var(--accent) / 0.14) 55%, transparent)" }}
          aria-hidden
        />
        <CardContent className="relative p-5 sm:p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Badge className="gap-1"><Crown className="h-3 w-3" /> {vipStatus?.isVip ? "You are VIP" : "VIP unlocks the full game"}</Badge>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Go further with Rockmundo VIP</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {vipStatus?.isVip
                ? `Your membership is active${vipStatus.daysRemaining ? ` for ${vipStatus.daysRemaining} more days` : ""}. Manage billing or grab extra character slots and cosmetics below.`
                : `Companies, world touring, recording and releases, awards, crew hiring and gig audio — everything in one membership from ${cheapestMonthly}/month.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CurrencySelector className="w-full md:w-auto" />
            <Button size="lg" onClick={() => navigate("/vip-subscribe")} className="gap-2">
              <Crown className="h-4 w-4" /> {vipStatus?.isVip ? "Manage VIP" : "Get VIP"}
            </Button>
            <Button size="lg" variant="outline" onClick={handleDonate} disabled={donating} className="gap-2">
              {donating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />} Donate {donationPrice}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Crown, label: "VIP Membership", description: "Unlock every premium system", path: "/vip-subscribe" },
          { icon: UserPlus, label: "Character Slots", description: `You have ${maxSlots} of 5 slots`, path: "/buy-character-slot" },
          { icon: Shirt, label: "Skin Store", description: "Outfits, looks and accessories", path: "/skin-store" },
          { icon: Package, label: "Blind Boxes", description: "Mystery XP, AP, gear and songs", path: "/blind-boxes" },
        ].map((tile) => (
          <button
            key={tile.path}
            onClick={() => navigate(tile.path)}
            className="text-left rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/60 hover:bg-accent/40"
          >
            <tile.icon className="h-5 w-5 text-primary" />
            <div className="mt-2 text-sm font-semibold">{tile.label}</div>
            <div className="text-xs text-muted-foreground">{tile.description}</div>
            <div className="mt-2 flex items-center gap-1 text-xs text-primary">Open <ArrowRight className="h-3 w-3" /></div>
          </button>
        ))}
      </div>

      {/* VIP plans */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Crown className="h-4 w-4 text-primary" /> VIP plans</CardTitle>
          <CardDescription>Pick the billing period that suits you — pay in USD, GBP or EUR. Cancel any time from the billing portal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {VIP_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "rounded-lg border p-4",
                plan.note?.includes("best") ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{plan.name}</span>
                {plan.note && <Badge variant="secondary" className="text-[10px]">{plan.note}</Badge>}
              </div>
              <div className="mt-2 text-2xl font-bold">
                {formatMinor(CHECKOUT_PRICING[plan.pricingKey][currency], currency)}
              </div>
              <div className="text-xs text-muted-foreground">{plan.period}</div>
              {plan.months > 1 && (
                <div className="text-[10px] text-muted-foreground">
                  {formatMinor(Math.round(CHECKOUT_PRICING[plan.pricingKey][currency] / plan.months), currency)}/month
                </div>
              )}
              <Button className="mt-3 w-full" variant={plan.note?.includes("best") ? "default" : "outline"} onClick={() => navigate("/vip-subscribe")}>
                Choose {plan.name}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Full VIP feature detail */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Everything included with VIP</CardTitle>
          <CardDescription>All {VIP_FEATURES.length} premium systems, included in every plan.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {VIP_FEATURES.map((feature) => (
            <div key={feature.title} className="flex gap-3 rounded-lg border border-border bg-card/60 p-3">
              <feature.icon className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <div>
                <div className="text-xs font-semibold flex items-center gap-1">
                  {feature.title} <Check className="h-3 w-3 text-primary" />
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Extra characters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4 text-primary" /> Extra characters</CardTitle>
          <CardDescription>How additional character slots work.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="space-y-2 text-muted-foreground">
            <li><span className="font-medium text-foreground">1. Everyone starts with 2 slots.</span> You can hold up to 5 characters in total.</li>
            <li><span className="font-medium text-foreground">2. Buy a slot.</span> Open Character Slots and complete the secure Stripe checkout in a new tab.</li>
            <li><span className="font-medium text-foreground">3. Create your character.</span> The slot unlocks immediately after payment and you can build a brand new artist.</li>
            <li><span className="font-medium text-foreground">4. Switch any time.</span> Each character keeps its own band, money, skills, schedule and history — nothing is shared.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => navigate("/buy-character-slot")} className="gap-2">
              <UserPlus className="h-4 w-4" /> Buy a character slot
            </Button>
            <Button variant="outline" onClick={() => navigate("/characters")}>Manage roster</Button>
          </div>
        </CardContent>
      </Card>

      {/* Donations */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Heart className="h-4 w-4 text-primary" /> Support the project</CardTitle>
          <CardDescription>Donations fund servers, AI generation costs and ongoing development.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="space-y-1 text-muted-foreground">
            <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0" /> One-off £10 donation, no subscription.</li>
            <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0" /> Earns the legendary “Project Supporter” achievement.</li>
            <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0" /> Grants 1,000 bonus XP to your active character.</li>
          </ul>
          <Button onClick={handleDonate} disabled={donating} className="gap-2">
            {donating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />} Donate {donationPrice}
          </Button>
        </CardContent>
      </Card>
    </FMPageScaffold>
  );
}
