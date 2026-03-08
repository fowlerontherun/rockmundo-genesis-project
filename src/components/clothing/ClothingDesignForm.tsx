import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scissors, Star } from "lucide-react";
import {
  CLOTHING_CATEGORIES,
  GENRE_STYLES,
  CATEGORY_EMOJIS,
  RARITY_COLORS,
  type ClothingScores,
  type ClothingCategory,
} from "@/utils/clothingQuality";

interface ClothingDesignFormProps {
  scores: ClothingScores;
  onSubmit: (data: {
    name: string;
    description?: string;
    category: string;
    genre_style: string;
    sale_price: number;
    stock_quantity: number;
  }) => void;
  isSubmitting: boolean;
}

export const ClothingDesignForm = ({
  scores,
  onSubmit,
  isSubmitting,
}: ClothingDesignFormProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("tops");
  const [genreStyle, setGenreStyle] = useState<string>("rock");
  const [salePrice, setSalePrice] = useState(scores.productionCost * 2);
  const [stockQuantity, setStockQuantity] = useState(10);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      genre_style: genreStyle,
      sale_price: salePrice,
      stock_quantity: stockQuantity,
    });
    setName("");
    setDescription("");
  };

  const rarityClass = RARITY_COLORS[scores.rarity] || "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scissors className="h-5 w-5" />
          Design New Item
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview scores */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
          <div className="text-4xl">
            {CATEGORY_EMOJIS[category as ClothingCategory] || "👕"}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Star className="h-3 w-3 text-warning" />
              <span className="text-sm">Quality: {scores.qualityScore}/100</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-3 w-3 text-primary" />
              <span className="text-sm">Style: {scores.styleScore}/100</span>
            </div>
            <Badge variant="outline" className={`capitalize ${rarityClass}`}>
              {scores.rarity}
            </Badge>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            Cost: ${scores.productionCost.toLocaleString()}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Item Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter item name..."
              maxLength={60}
            />
          </div>

          <div className="col-span-2">
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your creation..."
              maxLength={200}
            />
          </div>

          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLOTHING_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_EMOJIS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Genre Style</Label>
            <Select value={genreStyle} onValueChange={setGenreStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENRE_STYLES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Sale Price ($)</Label>
            <Input
              type="number"
              value={salePrice}
              onChange={(e) => setSalePrice(Number(e.target.value))}
              min={scores.productionCost}
            />
          </div>

          <div>
            <Label>Stock Quantity</Label>
            <Input
              type="number"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(Number(e.target.value))}
              min={1}
              max={100}
            />
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!name.trim() || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Creating..." : `Create Item (-$${scores.productionCost.toLocaleString()})`}
        </Button>
      </CardContent>
    </Card>
  );
};
