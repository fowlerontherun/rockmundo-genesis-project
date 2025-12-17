import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Check, Sparkles, Shirt, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

import type { Json } from "@/integrations/supabase/types";

interface ClothingItem {
  id: string;
  name: string;
  category: string;
  price: number | null;
  is_premium: boolean | null;
  rarity: string | null;
  color_variants: Json | null;
}

interface ClothingSelectorProps {
  clothingItems: ClothingItem[];
  selectedShirtId: string | null;
  selectedPantsId: string | null;
  selectedJacketId: string | null;
  selectedShoesId: string | null;
  shirtColor?: string;
  pantsColor?: string;
  shoesColor?: string;
  jacketColor?: string;
  onShirtSelect: (id: string | null) => void;
  onPantsSelect: (id: string | null) => void;
  onJacketSelect: (id: string | null) => void;
  onShoesSelect: (id: string | null) => void;
  onShirtColorChange?: (color: string) => void;
  onPantsColorChange?: (color: string) => void;
  onShoesColorChange?: (color: string) => void;
  onJacketColorChange?: (color: string) => void;
  isItemOwned: (id: string) => boolean;
  onPurchase: (id: string, price: number) => void;
}

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

export const ClothingSelector = ({
  clothingItems,
  selectedShirtId,
  selectedPantsId,
  selectedJacketId,
  selectedShoesId,
  shirtColor: _shirtColor,
  pantsColor: _pantsColor,
  shoesColor: _shoesColor,
  jacketColor: _jacketColor,
  onShirtSelect,
  onPantsSelect,
  onJacketSelect,
  onShoesSelect,
  onShirtColorChange: _onShirtColorChange,
  onPantsColorChange: _onPantsColorChange,
  onShoesColorChange: _onShoesColorChange,
  onJacketColorChange: _onJacketColorChange,
  isItemOwned,
  onPurchase,
}: ClothingSelectorProps) => {
  const shirts = clothingItems?.filter(item => item.category === 'shirt') || [];
  const pants = clothingItems?.filter(item => item.category === 'pants') || [];
  const jackets = clothingItems?.filter(item => item.category === 'jacket') || [];
  const shoes = clothingItems?.filter(item => item.category === 'shoes') || [];

  const renderItemGrid = (
    items: ClothingItem[],
    selectedId: string | null,
    onSelect: (id: string | null) => void,
    allowNone: boolean = true
  ) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {allowNone && (
        <div
          className={cn(
            "relative p-3 rounded-lg border-2 cursor-pointer transition-all",
            selectedId === null
              ? "border-primary bg-primary/10"
              : "border-border hover:border-muted-foreground/50"
          )}
          onClick={() => onSelect(null)}
        >
          <div className="w-12 h-12 mx-auto rounded-lg mb-2 bg-muted flex items-center justify-center">
            <CircleDashed className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-xs font-medium text-center">None</p>
        </div>
      )}

      {items.map((item) => {
        const isOwned = item.price === 0 || item.price === null || isItemOwned(item.id);
        const isSelected = selectedId === item.id;

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
            {/* Preview */}
            <div className="w-12 h-12 mx-auto rounded-lg mb-2 bg-secondary flex items-center justify-center">
              <Shirt className="h-6 w-6 text-muted-foreground" />
            </div>

            <p className="text-xs font-medium text-center truncate">{item.name}</p>

            {item.rarity && (
              <Badge 
                variant="secondary" 
                className={cn("text-[10px] mt-1 mx-auto block w-fit", getRarityColor(item.rarity))}
              >
                {item.rarity}
              </Badge>
            )}

            {/* Ownership/Purchase Status */}
            {isOwned ? (
              isSelected && (
                <div className="absolute top-1 right-1">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              )
            ) : (
              <div className="absolute inset-0 bg-background/80 rounded-lg flex flex-col items-center justify-center">
                <Lock className="h-4 w-4 text-muted-foreground mb-1" />
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs h-6 px-2"
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
              <Sparkles className="absolute top-1 left-1 h-3 w-3 text-yellow-400" />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <Tabs defaultValue="shirts" className="w-full">
      <TabsList className="w-full grid grid-cols-4">
        <TabsTrigger value="shirts">Shirts</TabsTrigger>
        <TabsTrigger value="pants">Pants</TabsTrigger>
        <TabsTrigger value="jackets">Jackets</TabsTrigger>
        <TabsTrigger value="shoes">Shoes</TabsTrigger>
      </TabsList>

      <TabsContent value="shirts" className="mt-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Shirts & Tops</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            {renderItemGrid(shirts, selectedShirtId, onShirtSelect, false)}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="pants" className="mt-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Pants & Bottoms</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            {renderItemGrid(pants, selectedPantsId, onPantsSelect, false)}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="jackets" className="mt-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Jackets & Outerwear</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            {renderItemGrid(jackets, selectedJacketId, onJacketSelect, true)}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="shoes" className="mt-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Shoes & Footwear</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            {renderItemGrid(shoes, selectedShoesId, onShoesSelect, false)}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};
