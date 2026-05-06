import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, Gem, Package, Sparkles } from "lucide-react";
import { BlindBoxPurchaseDialog } from "@/components/store/BlindBoxPurchaseDialog";
import { BlindBoxRevealDialog } from "@/components/store/BlindBoxRevealDialog";

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

  const cash = profile?.cash ?? 0;
  const tokens = (profile as any)?.premium_tokens ?? 0;

  const onPurchased = (result: RevealResult) => {
    setSelected(null);
    setReveal(result);
    qc.invalidateQueries({ queryKey: ["active-profile"] });
    qc.invalidateQueries({ queryKey: ["player-personal-gear"] });
    qc.invalidateQueries({ queryKey: ["songs"] });
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
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(box.tier_odds).map(([tier, pct]) => (
                      <Badge key={tier} variant="outline" className="text-[10px]">
                        {tier} {pct}%
                      </Badge>
                    ))}
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
