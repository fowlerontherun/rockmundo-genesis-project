import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Coins, Gem, Package, Sparkles, Info, Shield } from "lucide-react";
import { BlindBoxPurchaseDialog } from "@/components/store/BlindBoxPurchaseDialog";
import { BlindBoxRevealDialog } from "@/components/store/BlindBoxRevealDialog";
import { cn } from "@/lib/utils";

export type BlindBox = {
  id: string;
  slug: string;
  name: string;
  theme_genre: string;
  description: string;
  image_url: string | null;
  price_cash: number;
  price_premium: number;
  currency: "cash" | "premium";
  is_premium: boolean;
  available_from: string | null;
  available_until: string | null;
  skill_slugs: string[];
  tier_odds: Record<string, number>;
  pity_threshold: number;
  active: boolean;
};

export type RevealResult = {
  tier: string;
  xp: number;
  ap: number;
  skill_slug: string;
  instrument: { name: string; type: string; quality: number };
  song: { id: string; title: string; quality: number; genre: string };
  new_balance: number;
  currency: "cash" | "premium";
};

const TIER_COLOR: Record<string, string> = {
  common: "text-slate-300",
  rare: "text-blue-300",
  epic: "text-purple-300",
  legendary: "text-amber-300",
};

const TIER_BAR: Record<string, string> = {
  common: "bg-slate-400",
  rare: "bg-blue-400",
  epic: "bg-purple-400",
  legendary: "bg-amber-400",
};

export default function BlindBoxStore() {
  const { profile, profileId } = useActiveProfile();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<BlindBox | null>(null);
  const [reveal, setReveal] = useState<RevealResult | null>(null);

  const { data: boxes = [], isLoading } = useQuery({
    queryKey: ["blind-boxes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blind_boxes" as any)
        .select("*")
        .eq("active", true)
        .order("is_premium", { ascending: true })
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as BlindBox[];
    },
  });

  const { data: pityRows = [] } = useQuery({
    queryKey: ["blind-box-pity", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blind_box_pity" as any)
        .select("box_id, opens_since_epic, total_opens")
        .eq("profile_id", profileId!);
      if (error) throw error;
      return (data ?? []) as Array<{
        box_id: string;
        opens_since_epic: number;
        total_opens: number;
      }>;
    },
  });

  const pityByBox = new Map(pityRows.map((p) => [p.box_id, p]));

  const cash = profile?.cash ?? 0;
  const tokens = (profile as any)?.premium_tokens ?? 0;

  const onPurchased = (result: RevealResult) => {
    setSelected(null);
    setReveal(result);
    qc.invalidateQueries({ queryKey: ["active-profile"] });
    qc.invalidateQueries({ queryKey: ["player-personal-gear"] });
    qc.invalidateQueries({ queryKey: ["songs"] });
    qc.invalidateQueries({ queryKey: ["blind-box-pity", profileId] });
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-4 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Blind Box Store
          </h1>
          <p className="text-sm text-muted-foreground">
            Themed mystery boxes — XP, AP, a unique instrument, and a random song.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1">
            <Coins className="h-3 w-3" /> ${cash.toLocaleString()}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Gem className="h-3 w-3 text-purple-400" /> {tokens} tokens
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading boxes…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {boxes.map((box) => {
            const isPrem = box.currency === "premium";
            const price = isPrem ? box.price_premium : box.price_cash;
            const balance = isPrem ? tokens : cash;
            const canAfford = balance >= price;
            const pity = pityByBox.get(box.id);
            const opensSince = pity?.opens_since_epic ?? 0;
            const threshold = box.pity_threshold ?? 20;
            const opensUntil = Math.max(0, threshold - opensSince);
            const pityPct = Math.min(100, (opensSince / threshold) * 100);

            return (
              <Card key={box.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{box.name}</CardTitle>
                    {isPrem && (
                      <Badge variant="secondary" className="gap-1">
                        <Sparkles className="h-3 w-3" /> Premium
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="w-fit text-[10px]">
                    {box.theme_genre}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">{box.description}</p>

                  {/* Odds popover trigger */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-between h-8"
                      >
                        <span className="flex items-center gap-1 text-xs">
                          <Info className="h-3 w-3" /> View odds
                        </span>
                        <span className="flex gap-1">
                          {Object.entries(box.tier_odds).map(([tier, pct]) => (
                            <span
                              key={tier}
                              className={cn("text-[10px] tabular-nums", TIER_COLOR[tier])}
                            >
                              {pct}%
                            </span>
                          ))}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 space-y-2 p-3" align="start">
                      <div>
                        <p className="text-xs font-semibold">Drop rates</p>
                        <p className="text-[10px] text-muted-foreground">
                          Each opening rolls one tier independently.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {Object.entries(box.tier_odds).map(([tier, pct]) => (
                          <div key={tier} className="space-y-0.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className={cn("capitalize font-medium", TIER_COLOR[tier])}>
                                {tier}
                              </span>
                              <span className="tabular-nums text-muted-foreground">{pct}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", TIER_BAR[tier])}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-md border bg-muted/40 p-2 text-[10px] text-muted-foreground flex items-start gap-1.5">
                        <Shield className="h-3 w-3 mt-0.5 text-amber-400 flex-shrink-0" />
                        <span>
                          <strong className="text-foreground">Pity guarantee:</strong> if you open{" "}
                          {threshold} boxes without rolling Epic or Legendary, the next opening is
                          guaranteed Epic+.
                        </span>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Pity progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3 text-amber-400" /> Epic+ pity
                      </span>
                      <span className="tabular-nums">
                        {opensUntil === 0
                          ? "Next box guaranteed!"
                          : `${opensSince}/${threshold} (${opensUntil} to go)`}
                      </span>
                    </div>
                    <Progress
                      value={pityPct}
                      className={cn(
                        "h-1.5",
                        opensUntil === 0 && "[&>div]:bg-amber-400 [&>div]:animate-pulse",
                        opensUntil > 0 && opensUntil <= 3 && "[&>div]:bg-amber-400/70",
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 font-semibold">
                      {isPrem ? (
                        <>
                          <Gem className="h-4 w-4 text-purple-400" /> {price}
                        </>
                      ) : (
                        <>
                          <Coins className="h-4 w-4" /> ${price.toLocaleString()}
                        </>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setSelected(box)}
                      disabled={!profileId || !canAfford}
                    >
                      {canAfford ? "Open Box" : "Insufficient funds"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BlindBoxPurchaseDialog
        box={selected}
        balance={selected?.currency === "premium" ? tokens : cash}
        onClose={() => setSelected(null)}
        onPurchased={onPurchased}
      />
      <BlindBoxRevealDialog reveal={reveal} onClose={() => setReveal(null)} />
    </div>
  );
}
