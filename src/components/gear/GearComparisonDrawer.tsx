import { Fragment, useMemo } from "react";
import { CheckCircle2, Scale, ShieldCheck, Sparkles, TrendingUp, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { PlayerEquipmentWithItem } from "@/hooks/usePlayerEquipment";
import type { GearQualityTier } from "@/utils/gearQuality";
import { getQualityLabel, qualityTierStyles } from "@/utils/gearQuality";
import type { GearRarityKey } from "@/utils/gearRarity";
import { getRarityLabel, rarityStyles } from "@/utils/gearRarity";

export interface ComparableGearItem {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  price: number;
  rarityKey: GearRarityKey;
  qualityTier: GearQualityTier;
  stat_boosts: Record<string, number> | null;
  description: string | null;
  stock?: number | null;
}

interface GearComparisonDrawerProps {
  item: ComparableGearItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownedEquipment: PlayerEquipmentWithItem[] | undefined;
  cashOnHand: number;
}

const RARITY_EFFECTS: Record<GearRarityKey, string> = {
  common: "Baseline drop rates and minimal fan intrigue.",
  uncommon: "Small boost to fan interest and gig negotiations.",
  rare: "Noticeable draw for promoters and collaboration invites.",
  epic: "High demand item that spikes show hype and influencer buzz.",
  legendary: "Signature piece. Unlocks premium events and viral attention.",
};

const QUALITY_EFFECTS: Record<GearQualityTier, string> = {
  budget: "Reliable starter quality. Perfect for rehearsals and learning runs.",
  standard: "Tour-ready craftsmanship with predictable performance gains.",
  professional: "Studio-grade calibration. Boosts stage presence and sound checks.",
  boutique: "Handcrafted nuance adored by critics and superfans alike.",
  experimental: "Cutting-edge prototype effects that unlock unique skill combos.",
};

const sumBoosts = (boosts: Record<string, number> | null | undefined) => {
  if (!boosts) {
    return 0;
  }

  return Object.values(boosts).reduce((total, value) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return total;
    }

    return total + value;
  }, 0);
};

const formatStatKey = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const GearComparisonDrawer = ({
  item,
  open,
  onOpenChange,
  ownedEquipment,
  cashOnHand,
}: GearComparisonDrawerProps) => {
  const ownedInCategory = useMemo(() => {
    if (!item || !ownedEquipment) {
      return [] as PlayerEquipmentWithItem[];
    }

    return ownedEquipment.filter((entry) => entry.equipment?.category === item.category);
  }, [item, ownedEquipment]);

  const bestOwned = useMemo(() => {
    if (!ownedInCategory.length) {
      return null;
    }

    return ownedInCategory.reduce<PlayerEquipmentWithItem | null>((best, current) => {
      if (!best) {
        return current;
      }

      const bestScore = sumBoosts(best.equipment?.stat_boosts);
      const currentScore = sumBoosts(current.equipment?.stat_boosts);

      if (currentScore > bestScore) {
        return current;
      }

      return best;
    }, null);
  }, [ownedInCategory]);

  const statComparison = useMemo(() => {
    if (!item) {
      return [] as Array<{ stat: string; current: number; owned: number; delta: number }>;
    }

    const allStats = new Set<string>();
    const selectedBoosts = item.stat_boosts ?? {};
    const ownedBoosts = (bestOwned?.equipment?.stat_boosts ?? {}) as Record<string, number>;

    Object.keys(selectedBoosts).forEach((stat) => allStats.add(stat));
    Object.keys(ownedBoosts).forEach((stat) => allStats.add(stat));

    return Array.from(allStats).map((stat) => {
      const currentValue = typeof selectedBoosts[stat] === "number" ? selectedBoosts[stat] : 0;
      const ownedValue = typeof ownedBoosts[stat] === "number" ? ownedBoosts[stat] : 0;

      return {
        stat,
        current: currentValue,
        owned: ownedValue,
        delta: currentValue - ownedValue,
      };
    });
  }, [item, bestOwned]);

  const budgetDelta = useMemo(() => {
    if (!item) {
      return null;
    }

    return cashOnHand - item.price;
  }, [cashOnHand, item]);

  const duplicateCount = useMemo(() => {
    if (!item || !ownedEquipment) {
      return 0;
    }

    return ownedEquipment.filter((entry) => entry.equipment?.id === item.id).length;
  }, [item, ownedEquipment]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="space-y-2 border-b pb-4">
          <DrawerTitle className="flex flex-col gap-1 text-left">
            <span className="text-xs uppercase text-muted-foreground">Comparing</span>
            <span className="text-2xl font-semibold">{item?.name ?? "Select an item"}</span>
          </DrawerTitle>
          <DrawerDescription>
            Evaluate rarity perks, quality scaling, and stat shifts before committing to a purchase.
          </DrawerDescription>
        </DrawerHeader>
        <ScrollArea className="h-full">
          <div className="space-y-6 p-6">
            {item ? (
              <Fragment>
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={rarityStyles[item.rarityKey]}>
                      {getRarityLabel(item.rarityKey)}
                    </Badge>
                    <Badge variant="outline" className={qualityTierStyles[item.qualityTier]}>
                      {getQualityLabel(item.qualityTier)}
                    </Badge>
                    <Badge variant="secondary" className="ml-auto flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      ${item.price.toLocaleString()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description ?? "No flavour text provided."}</p>
                </section>

                <section className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Rarity and quality effects
                  </div>
                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <div className="rounded-md border bg-background/60 p-3 shadow-sm">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Rarity insight
                      </div>
                      <p className="mt-2 text-sm leading-relaxed">{RARITY_EFFECTS[item.rarityKey]}</p>
                    </div>
                    <div className="rounded-md border bg-background/60 p-3 shadow-sm">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Quality impact
                      </div>
                      <p className="mt-2 text-sm leading-relaxed">{QUALITY_EFFECTS[item.qualityTier]}</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Stat comparison
                  </div>
                  {statComparison.length === 0 ? (
                    <p className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                      This item does not influence tracked stats. Consider rarity and quality effects to judge its impact.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-md border">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2">Stat</th>
                            <th className="px-4 py-2">Selected</th>
                            <th className="px-4 py-2">Best owned</th>
                            <th className="px-4 py-2">Delta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statComparison.map((row) => (
                            <tr key={row.stat} className="border-t">
                              <td className="px-4 py-2 font-medium">{formatStatKey(row.stat)}</td>
                              <td className="px-4 py-2">+{row.current}</td>
                              <td className="px-4 py-2 text-muted-foreground">+{row.owned}</td>
                              <td
                                className={`px-4 py-2 font-semibold ${
                                  row.delta > 0
                                    ? "text-emerald-600"
                                    : row.delta < 0
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {row.delta > 0 ? "+" : ""}
                                {row.delta}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="space-y-3 rounded-lg border bg-background/80 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    <Scale className="h-4 w-4 text-primary" />
                    Purchase readiness
                  </div>
                  <div className="grid gap-4 text-sm md:grid-cols-2">
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="text-xs uppercase text-muted-foreground">Budget check</div>
                      <p className="mt-1 font-semibold">
                        Remaining after purchase: {budgetDelta !== null ? `$${budgetDelta.toLocaleString()}` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Current balance ${cashOnHand.toLocaleString()} minus listed price ${item.price.toLocaleString()}.
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="text-xs uppercase text-muted-foreground">Category depth</div>
                      <p className="mt-1 font-semibold">{ownedInCategory.length} owned in {item.category}</p>
                      <p className="text-xs text-muted-foreground">
                        Helps determine loadout overlap and whether this fills a gap in your rig.
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3 rounded-md border border-dashed bg-muted/20 p-3 text-sm">
                    <Users className="mt-1 h-4 w-4 text-primary" />
                    <div>
                      <p className="font-semibold">Ownership overlap</p>
                      {duplicateCount > 0 ? (
                        <p className="text-muted-foreground">
                          You already own {duplicateCount} {duplicateCount === 1 ? "copy" : "copies"} of this exact item.
                          Consider upgrading or selling extras before buying again.
                        </p>
                      ) : ownedInCategory.length > 0 ? (
                        <p className="text-muted-foreground">
                          You have {ownedInCategory.length} other pieces in this category. Compare stat deltas above to avoid
                          redundant purchases.
                        </p>
                      ) : (
                        <p className="text-muted-foreground">
                          No overlap detected. Picking this up expands your toolkit and opens new setlist synergies.
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                {bestOwned ? (
                  <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Best owned reference
                    </div>
                    <div className="flex flex-col gap-1 text-sm">
                      <p className="font-semibold">{bestOwned.equipment?.name ?? "Owned gear"}</p>
                      <p className="text-muted-foreground">
                        Total boost score {sumBoosts(bestOwned.equipment?.stat_boosts)} with condition {bestOwned.condition ?? 100}%.
                      </p>
                    </div>
                  </section>
                ) : null}
              </Fragment>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                Choose a gear card from the catalogue to preview stat swings and wallet impact here.
              </div>
            )}
          </div>
        </ScrollArea>
        <DrawerFooter className="border-t bg-background/95">
          <DrawerClose className="w-full rounded-md border bg-muted/50 px-4 py-2 text-sm font-medium">Close</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default GearComparisonDrawer;
