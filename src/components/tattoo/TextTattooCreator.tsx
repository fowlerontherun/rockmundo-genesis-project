import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Type } from "lucide-react";
import { TATTOO_FONTS, type TattooFontStyle } from "@/data/tattooFonts";
import { BODY_SLOTS, type BodySlot } from "@/data/tattooDesigns";

interface TextTattooCreatorProps {
  parlourPriceMultiplier: number;
  artistPricePremium: number;
  artistName?: string;
  occupiedSlots: Set<string>;
  onPurchase: (data: { text: string; fontStyle: string; bodySlot: BodySlot; price: number }) => void;
  isPending: boolean;
  playerCash: number;
}

const BASE_TEXT_PRICE = 150;

export const TextTattooCreator = ({
  parlourPriceMultiplier,
  artistPricePremium,
  artistName,
  occupiedSlots,
  onPurchase,
  isPending,
  playerCash,
}: TextTattooCreatorProps) => {
  const [text, setText] = useState("");
  const [selectedFont, setSelectedFont] = useState<TattooFontStyle>(TATTOO_FONTS[0]);
  const [selectedSlot, setSelectedSlot] = useState<BodySlot | null>(null);

  const availableSlots = Object.entries(BODY_SLOTS).filter(([key]) => !occupiedSlots.has(key));
  const price = Math.round(BASE_TEXT_PRICE * parlourPriceMultiplier * artistPricePremium * selectedFont.priceMultiplier);
  const canPurchase = text.trim().length > 0 && selectedSlot && playerCash >= price;

  return (
    <div className="space-y-4">
      {/* Text Input */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" />
            Your Text
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 40))}
            placeholder="Enter text (max 40 chars)..."
            className="text-lg"
            maxLength={40}
          />
          <p className="text-xs text-muted-foreground text-right">{text.length}/40</p>
        </CardContent>
      </Card>

      {/* Font Picker */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Choose Font Style</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[280px]">
            <div className="space-y-2">
              {TATTOO_FONTS.map((font) => (
                <div
                  key={font.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedFont.id === font.id
                      ? 'ring-2 ring-primary border-primary/50 bg-primary/5'
                      : 'border-border hover:bg-muted/30'
                  }`}
                  onClick={() => setSelectedFont(font)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{font.label}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        x{font.priceMultiplier}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">{font.description}</p>
                  {/* Preview */}
                  <div className="bg-muted/50 rounded-md p-3 min-h-[36px] flex items-center justify-center">
                    <span
                      className="text-foreground text-base truncate"
                      style={font.css}
                    >
                      {text || 'Born to Rock'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Body Slot Selector */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Body Placement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {availableSlots.map(([key, slot]) => (
              <Badge
                key={key}
                variant={selectedSlot === key ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setSelectedSlot(key as BodySlot)}
              >
                {slot.label}
              </Badge>
            ))}
            {availableSlots.length === 0 && (
              <p className="text-xs text-muted-foreground">All body slots are filled!</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Purchase Summary */}
      <Card className="border-primary/50">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Text Tattoo Summary</h3>
            <span className="text-lg font-bold text-primary">${price}</span>
          </div>
          
          {text && (
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <span className="text-foreground text-xl" style={selectedFont.css}>
                {text}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            {selectedSlot && (
              <Badge variant="outline">{BODY_SLOTS[selectedSlot].label}</Badge>
            )}
            <Badge variant="outline">{selectedFont.label}</Badge>
            {artistName && <Badge variant="outline">by {artistName}</Badge>}
          </div>

          <Button
            onClick={() => {
              if (selectedSlot && text.trim()) {
                onPurchase({ text: text.trim(), fontStyle: selectedFont.id, bodySlot: selectedSlot, price });
              }
            }}
            disabled={!canPurchase || isPending}
            className="w-full"
          >
            {isPending ? 'Getting inked...' : `Get Text Tattoo — $${price}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
