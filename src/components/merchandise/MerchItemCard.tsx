import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Lock, Star, Users, Award, Clock3, Factory, Package, Palette, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MerchItemRequirement, QUALITY_TIERS, checkMerchUnlocked, getUnlockProgress } from "@/hooks/useMerchRequirements";
import { MerchProductMockup } from "./MerchProductMockup";
import { shapeForMerchProduct } from "./merchProductShape";

interface MerchItemCardProps {
  item: MerchItemRequirement;
  playerFame: number;
  playerFans: number;
  playerLevel: number;
  onSelect?: (item: MerchItemRequirement) => void;
  isSelected?: boolean;
}

const humanize = (value?: string | null) => {
  if (!value) return "Standard";
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const previewColor = (item: MerchItemRequirement) => {
  const first = item.colour_options?.find((value) => /^#[0-9a-f]{6}$/i.test(value));
  return first ?? "#171717";
};

export const MerchItemCard = ({
  item,
  playerFame,
  playerFans,
  playerLevel,
  onSelect,
  isSelected,
}: MerchItemCardProps) => {
  const { unlocked, reason } = checkMerchUnlocked(item, playerFame, playerFans, playerLevel);
  const progress = getUnlockProgress(item, playerFame, playerFans, playerLevel);
  const qualityInfo = QUALITY_TIERS[item.base_quality_tier];
  const productKind = item.product_kind ?? (item.category === "Experiences" ? "experience" : "physical");
  const isExperience = productKind === "experience";
  const isDigital = productKind === "digital";
  const isPhysical = productKind === "physical";
  const isInstant = (item.lead_time_days ?? 0) <= 0;

  return (
    <Card
      className={cn(
        "relative cursor-pointer overflow-hidden transition-all hover:shadow-md",
        !unlocked && "opacity-75",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={() => unlocked && onSelect?.(item)}
    >
      {!unlocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[1px]">
          <div className="p-4 text-center">
            <Lock className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">{reason}</p>
            <Progress value={progress * 100} className="mt-2 h-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">{Math.round(progress * 100)}% progress</p>
          </div>
        </div>
      )}

      <div className="relative h-32 border-b bg-gradient-to-b from-muted/10 to-muted/45">
        {isPhysical ? (
          <MerchProductMockup shape={shapeForMerchProduct(item.item_type)} color={previewColor(item)} area={item.print_areas?.[0] ?? "front"} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-background/75 shadow-sm">
              {isExperience ? <Star className="h-8 w-8 text-primary" /> : <Music2 className="h-8 w-8 text-primary" />}
            </div>
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          <Badge variant="secondary" className="bg-background/85 text-[10px] backdrop-blur-sm">{item.category}</Badge>
          {item.is_personalisable && isPhysical ? <Badge variant="secondary" className="bg-background/85 text-[10px] backdrop-blur-sm">Customisable</Badge> : null}
        </div>
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1 text-sm">{item.item_type}</CardTitle>
          <Badge variant="outline" className={cn("text-xs", qualityInfo.color)}>{qualityInfo.label}</Badge>
        </div>
        <CardDescription className="line-clamp-2 text-xs">{item.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {isExperience ? (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground"><Star className="h-3 w-3" /><span>{item.min_fame.toLocaleString()}</span></div>
            <div className="flex items-center gap-1 text-muted-foreground"><Users className="h-3 w-3" /><span>{item.min_fans.toLocaleString()}</span></div>
            <div className="flex items-center gap-1 text-muted-foreground"><Award className="h-3 w-3" /><span>Lv {item.min_level}</span></div>
          </div>
        ) : isDigital ? (
          <div className="flex items-center gap-2 rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
            <Music2 className="h-3.5 w-3.5" /> Digital product · no manufacturing lead time
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground"><Factory className="h-3 w-3 shrink-0" /><span className="truncate">{humanize(item.supplier_tier)} supplier</span></div>
            <div className="flex items-center gap-1.5 text-muted-foreground"><Clock3 className="h-3 w-3 shrink-0" /><span>{isInstant ? "Immediate" : `${item.lead_time_days} day lead`}</span></div>
            <div className="flex items-center gap-1.5 text-muted-foreground"><Package className="h-3 w-3 shrink-0" /><span>MOQ {Math.max(1, item.min_order_qty ?? 1)}</span></div>
            <div className="flex items-center gap-1.5 text-muted-foreground"><Palette className="h-3 w-3 shrink-0" /><span>{item.is_personalisable ? "Customisable" : humanize(item.base_material)}</span></div>
          </div>
        )}

        {item.base_material && isPhysical ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">Material: <span className="text-foreground">{humanize(item.base_material)}</span></p>
        ) : null}

        <div className="rounded-md bg-muted/30 p-2 text-xs">
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Unit cost</span><span className="font-medium">${item.base_cost}</span></div>
          <div className="mt-1 flex items-center justify-between"><span className="text-muted-foreground">Recommended retail</span><span className="font-semibold text-primary">${item.recommended_retail_price ?? "—"}</span></div>
          {item.minimum_retail_price ? <div className="mt-1 flex items-center justify-between"><span className="text-muted-foreground">Minimum retail</span><span>${item.minimum_retail_price}</span></div> : null}
        </div>

        {isPhysical && (item.min_order_qty ?? 1) > 1 ? (
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Minimum production run</span><span>${(item.base_cost * Math.max(1, item.min_order_qty ?? 1)).toLocaleString()}</span></div>
        ) : null}

        {unlocked && (
          <Button size="sm" variant="outline" className="mt-2 w-full" onClick={(event) => { event.stopPropagation(); onSelect?.(item); }}>
            {isExperience ? "Select" : "Configure Product"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
