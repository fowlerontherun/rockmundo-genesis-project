import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Check, Sparkles, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccessoryItem {
  id: string;
  name: string;
  category: string;
  price: number | null;
  is_premium: boolean | null;
  rarity: string | null;
}

interface AccessorySelectorProps {
  accessories: AccessoryItem[];
  selectedAccessory1: string | null;
  selectedAccessory2: string | null;
  onAccessory1Select: (id: string | null) => void;
  onAccessory2Select: (id: string | null) => void;
  isItemOwned: (id: string) => boolean;
  onPurchase: (id: string, price: number) => void;
}

const accessoryEmoji: Record<string, string> = {
  sunglasses: '🕶️',
  glasses: '👓',
  headphones: '🎧',
  cap: '🧢',
  beanie: '🎿',
  bandana: '🎀',
  chain: '⛓️',
  necklace: '📿',
  earring: '💎',
  watch: '⌚',
  bracelet: '📿',
  ring: '💍',
  default: '✨',
};

const getRarityColor = (rarity: string | null) => {
  switch (rarity) {
    case 'common': return 'bg-muted text-muted-foreground';
    case 'uncommon': return 'bg-green-600/20 text-green-400';
    case 'rare': return 'bg-blue-600/20 text-blue-400';
    case 'epic': return 'bg-purple-600/20 text-purple-400';
    case 'legendary': return 'bg-yellow-600/20 text-yellow-400';
    default: return 'bg-muted text-muted-foreground';
  }
};

export const AccessorySelector = ({
  accessories,
  selectedAccessory1,
  selectedAccessory2,
  onAccessory1Select,
  onAccessory2Select,
  isItemOwned,
  onPurchase,
}: AccessorySelectorProps) => {
  const headAccessories = accessories?.filter(item => 
    ['sunglasses', 'glasses', 'headphones', 'cap', 'beanie', 'bandana'].includes(item.category)
  ) || [];

  const jewelryAccessories = accessories?.filter(item =>
    ['chain', 'necklace', 'earring', 'watch', 'bracelet', 'ring'].includes(item.category)
  ) || [];

  const renderAccessoryGrid = (
    title: string,
    items: AccessoryItem[],
    selectedId: string | null,
    onSelect: (id: string | null) => void
  ) => (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
          {/* None option */}
          <div
            className={cn(
              "relative p-3 rounded-lg border-2 cursor-pointer transition-all",
              selectedId === null
                ? "border-primary bg-primary/10"
                : "border-border hover:border-muted-foreground/50"
            )}
            onClick={() => onSelect(null)}
          >
            <div className="w-10 h-10 mx-auto rounded-lg mb-2 bg-muted flex items-center justify-center">
              <CircleDashed className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs font-medium text-center">None</p>
          </div>

          {items.map((item) => {
            const isOwned = item.price === 0 || item.price === null || isItemOwned(item.id);
            const isSelected = selectedId === item.id;
            const emoji = accessoryEmoji[item.category] || accessoryEmoji.default;

            return (
              <div
                key={item.id}
                className={cn(
                  "relative p-3 rounded-lg border-2 cursor-pointer transition-all",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/50"
                )}
                onClick={() => {
                  if (isOwned) {
                    onSelect(item.id);
                  }
                }}
              >
                <div className="text-2xl text-center mb-1">{emoji}</div>
                <p className="text-[10px] font-medium text-center truncate">{item.name}</p>

                {item.rarity && (
                  <Badge 
                    variant="secondary" 
                    className={cn("text-[8px] mt-1 mx-auto block w-fit px-1", getRarityColor(item.rarity))}
                  >
                    {item.rarity}
                  </Badge>
                )}

                {/* Ownership/Purchase Status */}
                {isOwned ? (
                  isSelected && (
                    <div className="absolute top-1 right-1">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                  )
                ) : (
                  <div className="absolute inset-0 bg-background/80 rounded-lg flex flex-col items-center justify-center">
                    <Lock className="h-3 w-3 text-muted-foreground mb-1" />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-[10px] h-5 px-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPurchase(item.id, item.price || 0);
                      }}
                    >
                      ${item.price}
                    </Button>
                  </div>
                )}

                {item.is_premium && (
                  <Sparkles className="absolute top-1 left-1 h-2 w-2 text-yellow-400" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {renderAccessoryGrid('Head Accessories', headAccessories, selectedAccessory1, onAccessory1Select)}
      {renderAccessoryGrid('Jewelry & Extras', jewelryAccessories, selectedAccessory2, onAccessory2Select)}
    </div>
  );
};
