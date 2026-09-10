import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Sparkles, Star, Crown, Zap, Activity, Mic2, Disc3, PenLine } from "lucide-react";
import { CountdownTimer } from "./CountdownTimer";
import { ClothingItem } from "@/hooks/useSkinStore";
import { usablePreviewFrames } from "@/features/clothing-preview/previewManifest";

interface StoreItemCardProps {
  item: ClothingItem;
  isOwned: boolean;
  onPurchase: (item: ClothingItem) => void;
  onPreview?: (item: ClothingItem) => void;
}

const rarityColors: Record<string, string> = {
  common: "border-muted-foreground/30 text-muted-foreground",
  uncommon: "border-success/50 text-success",
  rare: "border-primary/50 text-primary",
  epic: "border-accent/50 text-accent",
  legendary: "border-warning/50 text-warning",
};

const rarityIcons: Record<string, React.ReactNode> = {
  common: null,
  uncommon: <Star className="h-3 w-3" />,
  rare: <Sparkles className="h-3 w-3" />,
  epic: <Sparkles className="h-3 w-3" />,
  legendary: <Crown className="h-3 w-3" />,
};

const categoryIcons: Record<string, string> = {
  shirt: "👕",
  "t-shirt": "👕",
  pants: "👖",
  jeans: "👖",
  jacket: "🧥",
  coat: "🧥",
  shoes: "👟",
  boots: "🥾",
  trainers: "👟",
  accessory: "🎸",
  hat: "🎩",
  glasses: "👓",
};

type BonusPill = { key: string; label: string; icon: React.ReactNode };

function bonusPills(item: ClothingItem): BonusPill[] {
  if (!item.bonus_enabled || !item.bonus_config) return [];
  const cfg = item.bonus_config;
  const pills: BonusPill[] = [];
  if ((cfg.daily_xp || 0) > 0) pills.push({ key: "xp", label: `+${cfg.daily_xp} daily XP`, icon: <Zap className="h-3 w-3" /> });
  if ((cfg.daily_ap || 0) > 0) pills.push({ key: "ap", label: `+${cfg.daily_ap} daily AP`, icon: <Activity className="h-3 w-3" /> });
  if ((cfg.performance_pct || 0) > 0) pills.push({ key: "performance", label: `+${cfg.performance_pct}% performance`, icon: <Mic2 className="h-3 w-3" /> });
  if ((cfg.recording_pct || 0) > 0) pills.push({ key: "recording", label: `+${cfg.recording_pct}% recording`, icon: <Disc3 className="h-3 w-3" /> });
  if ((cfg.songwriting_pct || 0) > 0) pills.push({ key: "songwriting", label: `+${cfg.songwriting_pct}% songwriting`, icon: <PenLine className="h-3 w-3" /> });
  return pills;
}

export const StoreItemCard = ({ item, isOwned, onPurchase, onPreview }: StoreItemCardProps) => {
  const rarity = item.rarity || "common";
  const rarityClass = rarityColors[rarity] || rarityColors.common;
  const isLimited = item.is_limited_edition && item.expiry_date;
  const bonuses = bonusPills(item);
  const generatedFrames = usablePreviewFrames(item.preview_manifest);
  const thumbnail = generatedFrames.find(frame => frame.key === 'front')?.url || generatedFrames[0]?.url;

  return (
    <Card className={`relative overflow-hidden hover:shadow-electric transition-all duration-300 group ${item.featured ? "ring-2 ring-warning/50" : ""}`}>
      {item.featured && (
        <div className="absolute top-0 right-0 bg-warning text-warning-foreground px-2 py-0.5 text-xs font-semibold rounded-bl-lg z-10">Featured</div>
      )}

      <button type="button" className="relative h-44 w-full bg-card flex items-center justify-center overflow-hidden" onClick={() => onPreview?.(item)} aria-label={`Preview ${item.name}`}>
        {thumbnail ? (
          <img src={thumbnail} alt={`${item.name} clothing preview`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <span className="text-5xl">{categoryIcons[item.category] || "👕"}</span>
        )}

        {thumbnail && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent h-14 pointer-events-none" />}

        {item.color_variants && Array.isArray(item.color_variants) && (
          <div className="absolute bottom-2 left-2 flex gap-1 z-[1]">
            {(item.color_variants as string[]).slice(0, 4).map((color, idx) => (
              <div key={idx} className="w-4 h-4 rounded-full border border-white/60 shadow-sm" style={{ backgroundColor: color }} />
            ))}
            {item.color_variants.length > 4 && <span className="text-xs text-white drop-shadow">+{item.color_variants.length - 4}</span>}
          </div>
        )}

        {thumbnail && <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] bg-background/80 backdrop-blur">360° preview</Badge>}

        {isOwned && (
          <div className="absolute inset-0 bg-success/20 flex items-center justify-center">
            <div className="bg-success rounded-full p-2"><Check className="h-6 w-6 text-success-foreground" /></div>
          </div>
        )}
      </button>

      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground capitalize">{item.wearable_slot || item.category}</span>
          {rarity !== "common" && (
            <Badge variant="outline" className={`text-xs ${rarityClass}`}>{rarityIcons[rarity]}<span className="ml-1 capitalize">{rarity}</span></Badge>
          )}
        </div>

        <h4 className="font-medium text-foreground truncate mb-2">{item.name}</h4>

        {bonuses.length > 0 && (
          <div className="mb-3 rounded-md border border-primary/20 bg-primary/5 p-2">
            <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary"><Sparkles className="h-3 w-3" />Equipped bonuses</div>
            <div className="flex flex-wrap gap-1">
              {bonuses.map((bonus) => <Badge key={bonus.key} variant="secondary" className="gap-1 text-[10px] font-normal">{bonus.icon}{bonus.label}</Badge>)}
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">Bonuses apply only while this item is equipped and are subject to outfit-wide caps.</p>
          </div>
        )}

        {isLimited && <div className="mb-2"><CountdownTimer endDate={item.expiry_date!} className="text-xs" /></div>}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {item.is_premium ? <Lock className="h-3.5 w-3.5 text-warning" /> : null}
            <span className="font-bold text-foreground">${item.price?.toLocaleString() || "Free"}</span>
          </div>

          {isOwned ? (
            <Button variant="outline" size="sm" disabled>Owned</Button>
          ) : (
            <div className="flex gap-1">
              {onPreview && <Button variant="ghost" size="sm" onClick={() => onPreview(item)}>Try</Button>}
              <Button variant="default" size="sm" onClick={() => onPurchase(item)}>Buy</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
