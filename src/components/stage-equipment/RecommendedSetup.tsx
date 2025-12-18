import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Sparkles, Music, Users, Star, Zap } from "lucide-react";

interface BandProfile {
  genre: string | null;
  fame: number;
  memberCount: number;
}

interface EquipmentItem {
  id: string;
  name: string;
  brand: string | null;
  subcategory: string | null;
  base_price: number | null;
  rarity: string | null;
  quality_rating: number | null;
  description: string | null;
  stat_boosts: Record<string, number> | null;
}

interface RecommendedSetupProps {
  bandProfile: BandProfile;
  catalogItems: EquipmentItem[];
  ownedItemNames: string[];
  onPurchase: (item: EquipmentItem) => void;
  isPurchasing: boolean;
}

// Genre to equipment priority mapping
const genreEquipmentPriority: Record<string, string[]> = {
  "Rock": ["pa_speaker", "subwoofer", "monitor", "wireless_guitar", "moving_head", "fog", "strobe"],
  "Heavy Metal": ["pa_speaker", "subwoofer", "line_array", "wireless_guitar", "fog", "strobe", "effects"],
  "Punk": ["pa_speaker", "monitor", "wireless_mic", "strobe", "fog"],
  "Alternative": ["pa_speaker", "monitor", "moving_head", "hazer", "wireless_guitar"],
  "Indie/Bedroom Pop": ["pa_speaker", "monitor", "par_light", "hazer", "di_box"],
  "Pop": ["pa_speaker", "line_array", "moving_head", "iem", "effects", "hazer"],
  "Electronic": ["subwoofer", "pa_speaker", "line_array", "moving_head", "strobe", "fog", "hazer", "effects"],
  "Electronica": ["subwoofer", "pa_speaker", "moving_head", "strobe", "fog", "hazer", "effects"],
  "Hip Hop": ["subwoofer", "pa_speaker", "wireless_mic", "iem", "moving_head", "strobe"],
  "R&B": ["pa_speaker", "monitor", "iem", "wireless_mic", "par_light", "hazer"],
  "Jazz": ["pa_speaker", "monitor", "di_box", "mixer", "par_light"],
  "Blues": ["pa_speaker", "monitor", "di_box", "wireless_guitar", "par_light"],
  "Country": ["pa_speaker", "monitor", "wireless_mic", "wireless_guitar", "par_light"],
  "Folk": ["pa_speaker", "monitor", "di_box", "mixer", "par_light"],
  "Reggae": ["subwoofer", "pa_speaker", "monitor", "mixer", "par_light", "hazer"],
  "Soul": ["pa_speaker", "monitor", "iem", "wireless_mic", "par_light", "hazer"],
  "Funk": ["subwoofer", "pa_speaker", "monitor", "wireless_mic", "moving_head", "strobe"],
  "Classical": ["pa_speaker", "monitor", "di_box", "mixer", "par_light"],
};

// Fame tiers determine budget and quality
const getFameTier = (fame: number): { tier: string; maxPrice: number; minQuality: number; description: string } => {
  if (fame < 100) return { tier: "Garage Band", maxPrice: 2000, minQuality: 50, description: "Budget-friendly essentials" };
  if (fame < 500) return { tier: "Club Act", maxPrice: 5000, minQuality: 60, description: "Solid mid-range gear" };
  if (fame < 2000) return { tier: "Rising Star", maxPrice: 15000, minQuality: 70, description: "Professional equipment" };
  if (fame < 10000) return { tier: "Established Artist", maxPrice: 50000, minQuality: 80, description: "Premium touring gear" };
  return { tier: "Superstar", maxPrice: 999999, minQuality: 85, description: "World-class equipment" };
};

// Member count affects equipment needs
const getMemberNeeds = (count: number): { iems: number; monitors: number; mics: number; description: string } => {
  if (count <= 1) return { iems: 1, monitors: 2, mics: 1, description: "Solo setup" };
  if (count <= 3) return { iems: 3, monitors: 3, mics: 2, description: "Small band setup" };
  if (count <= 5) return { iems: 5, monitors: 4, mics: 3, description: "Full band setup" };
  return { iems: 6, monitors: 6, mics: 4, description: "Large ensemble setup" };
};

export const RecommendedSetup = ({ 
  bandProfile, 
  catalogItems, 
  ownedItemNames,
  onPurchase,
  isPurchasing 
}: RecommendedSetupProps) => {
  const fameTier = getFameTier(bandProfile.fame);
  const memberNeeds = getMemberNeeds(bandProfile.memberCount);
  const genrePriority = genreEquipmentPriority[bandProfile.genre || "Rock"] || genreEquipmentPriority["Rock"];

  const recommendations = useMemo(() => {
    const categoryBudgets: Record<string, { items: EquipmentItem[]; priority: number }> = {};
    
    // Group items by subcategory with priority
    catalogItems.forEach(item => {
      const sub = item.subcategory || "other";
      const priorityIndex = genrePriority.indexOf(sub);
      const priority = priorityIndex === -1 ? 100 : priorityIndex;
      
      // Filter by fame tier budget and quality
      if ((item.base_price || 0) > fameTier.maxPrice) return;
      if ((item.quality_rating || 0) < fameTier.minQuality) return;
      
      if (!categoryBudgets[sub]) {
        categoryBudgets[sub] = { items: [], priority };
      }
      categoryBudgets[sub].items.push(item);
    });

    // Sort items within each category by quality (best first)
    Object.values(categoryBudgets).forEach(cat => {
      cat.items.sort((a, b) => (b.quality_rating || 0) - (a.quality_rating || 0));
    });

    // Build recommended list based on priorities
    const recommended: { item: EquipmentItem; reason: string; category: string }[] = [];

    // Essential categories for every setup
    const essentials = ["pa_speaker", "mixer", "monitor"];
    essentials.forEach(cat => {
      if (categoryBudgets[cat]?.items.length) {
        const bestItem = categoryBudgets[cat].items[0];
        recommended.push({
          item: bestItem,
          reason: "Essential for any live performance",
          category: cat,
        });
      }
    });

    // Genre-specific priorities
    genrePriority.slice(0, 5).forEach(cat => {
      if (essentials.includes(cat)) return;
      if (categoryBudgets[cat]?.items.length) {
        const bestItem = categoryBudgets[cat].items[0];
        recommended.push({
          item: bestItem,
          reason: `Recommended for ${bandProfile.genre || "Rock"}`,
          category: cat,
        });
      }
    });

    // Add IEMs based on member count
    if (categoryBudgets["iem"]?.items.length) {
      const iemItem = categoryBudgets["iem"].items[0];
      for (let i = 0; i < Math.min(memberNeeds.iems, 2); i++) {
        recommended.push({
          item: iemItem,
          reason: `IEM for band member ${i + 1}`,
          category: "iem",
        });
      }
    }

    // Add wireless mics based on member count
    if (categoryBudgets["wireless_mic"]?.items.length) {
      const micItem = categoryBudgets["wireless_mic"].items[0];
      recommended.push({
        item: micItem,
        reason: "Wireless freedom for vocalists",
        category: "wireless_mic",
      });
    }

    // Add lighting based on fame tier
    if (fameTier.minQuality >= 60 && categoryBudgets["moving_head"]?.items.length) {
      recommended.push({
        item: categoryBudgets["moving_head"].items[0],
        reason: "Dynamic stage lighting",
        category: "moving_head",
      });
    }

    // Add atmosphere effects
    if (categoryBudgets["hazer"]?.items.length || categoryBudgets["fog"]?.items.length) {
      const atmosItem = categoryBudgets["hazer"]?.items[0] || categoryBudgets["fog"]?.items[0];
      if (atmosItem) {
        recommended.push({
          item: atmosItem,
          reason: "Atmospheric effects for better lighting visibility",
          category: atmosItem.subcategory || "effects",
        });
      }
    }

    return recommended;
  }, [catalogItems, bandProfile, fameTier, memberNeeds, genrePriority]);

  const totalCost = recommendations.reduce((sum, r) => sum + (r.item.base_price || 0), 0);
  const ownedCount = recommendations.filter(r => ownedItemNames.includes(r.item.name)).length;

  const rarityColors: Record<string, string> = {
    common: "bg-slate-500",
    uncommon: "bg-emerald-500",
    rare: "bg-blue-500",
    epic: "bg-purple-500",
    legendary: "bg-amber-500",
  };

  const subcategoryLabels: Record<string, string> = {
    pa_speaker: "🔊 PA Speaker",
    subwoofer: "🔉 Subwoofer",
    line_array: "📢 Line Array",
    mixer: "🎛️ Mixer",
    monitor: "🎧 Monitor",
    moving_head: "💡 Moving Head",
    par_light: "🔦 Par Light",
    strobe: "⚡ Strobe",
    fog: "🌫️ Fog Machine",
    hazer: "💨 Hazer",
    iem: "🎧 IEM",
    wireless_mic: "🎤 Wireless Mic",
    wireless_guitar: "🎸 Wireless Guitar",
    di_box: "📦 DI Box",
    cable: "🔌 Cable",
    effects: "✨ Effects",
  };

  return (
    <div className="space-y-6">
      {/* Band Profile Summary */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Recommended Setup for Your Band
          </CardTitle>
          <CardDescription>
            Curated equipment suggestions based on your style, size, and career stage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <Music className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Genre</p>
                <p className="font-semibold">{bandProfile.genre || "Rock"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <Star className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Fame Tier</p>
                <p className="font-semibold">{fameTier.tier}</p>
                <p className="text-xs text-muted-foreground">{fameTier.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <Users className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Band Size</p>
                <p className="font-semibold">{bandProfile.memberCount} members</p>
                <p className="text-xs text-muted-foreground">{memberNeeds.description}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1">
          <Zap className="h-4 w-4 text-primary" />
          <span>{recommendations.length} items recommended</span>
        </div>
        <div className="rounded-full bg-muted px-3 py-1">
          Total: <span className="font-bold">${totalCost.toLocaleString()}</span>
        </div>
        <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-700 dark:text-emerald-300">
          {ownedCount}/{recommendations.length} already owned
        </div>
      </div>

      {/* Recommended Items */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {recommendations.map((rec, idx) => {
          const isOwned = ownedItemNames.includes(rec.item.name);
          return (
            <Card 
              key={`${rec.item.id}-${idx}`} 
              className={`relative overflow-hidden transition-all ${isOwned ? "opacity-60 border-emerald-500/50" : "hover:border-primary/50"}`}
            >
              {isOwned && (
                <div className="absolute top-2 left-2 z-10">
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    ✓ Owned
                  </Badge>
                </div>
              )}
              <div 
                className={`absolute top-0 right-0 w-16 h-16 opacity-10 ${rarityColors[rec.item.rarity?.toLowerCase() || 'common']}`}
                style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }} 
              />
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Badge variant="outline" className="text-[10px] mb-1">
                      {subcategoryLabels[rec.category] || rec.category}
                    </Badge>
                    <CardTitle className="text-sm truncate">{rec.item.name}</CardTitle>
                    {rec.item.brand && (
                      <CardDescription className="text-xs font-medium">{rec.item.brand}</CardDescription>
                    )}
                  </div>
                  <Badge className={`text-[10px] px-1.5 shrink-0 ${rarityColors[rec.item.rarity?.toLowerCase() || 'common']}`}>
                    {rec.item.rarity}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0 pb-3">
                <p className="text-[11px] text-primary font-medium">{rec.reason}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{rec.item.description}</p>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-base font-bold">
                    ${rec.item.base_price?.toLocaleString()}
                  </div>
                  {!isOwned && (
                    <Button
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => onPurchase(rec.item)}
                      disabled={isPurchasing}
                    >
                      <ShoppingCart className="h-3 w-3 mr-1" /> Buy
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
