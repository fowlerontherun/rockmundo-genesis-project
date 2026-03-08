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
import { Scissors, Store, TrendingUp, DollarSign, Package } from "lucide-react";
import { useClothingBrand } from "@/hooks/useClothingBrand";
import { useSkillSystem } from "@/hooks/useSkillSystem";
import { calculateClothingScores, GENRE_STYLES } from "@/utils/clothingQuality";
import { ClothingDesignForm } from "@/components/clothing/ClothingDesignForm";
import { ClothingItemCard } from "@/components/clothing/ClothingItemCard";

const ClothingDesigner = () => {
  const { brand, items, loading, createBrand, createItem } = useClothingBrand();
  const { progress } = useSkillSystem();
  const scores = calculateClothingScores(progress);

  const [brandName, setBrandName] = useState("");
  const [brandDesc, setBrandDesc] = useState("");
  const [brandGenre, setBrandGenre] = useState("rock");

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Brand creation flow
  if (!brand) {
    return (
      <div className="container max-w-lg mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Create Your Clothing Brand
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Start your fashion empire by naming your brand and choosing a genre focus.
            </p>
            <div>
              <Label>Brand Name</Label>
              <Input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Enter brand name..."
                maxLength={40}
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={brandDesc}
                onChange={(e) => setBrandDesc(e.target.value)}
                placeholder="What's your brand about?"
                maxLength={200}
              />
            </div>
            <div>
              <Label>Genre Focus</Label>
              <Select value={brandGenre} onValueChange={setBrandGenre}>
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
            <Button
              onClick={() =>
                createBrand.mutate({
                  brand_name: brandName,
                  brand_description: brandDesc || undefined,
                  genre_focus: brandGenre,
                })
              }
              disabled={!brandName.trim() || createBrand.isPending}
              className="w-full"
            >
              {createBrand.isPending ? "Creating..." : "Launch Brand"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Brand Dashboard */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scissors className="h-6 w-6" />
          {brand.brand_name}
        </h1>
        <p className="text-muted-foreground text-sm">{brand.brand_description || "Your clothing brand"}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{brand.reputation}</p>
            <p className="text-xs text-muted-foreground">Reputation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">${brand.total_revenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Package className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{brand.total_sales}</p>
            <p className="text-xs text-muted-foreground">Items Sold</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Badge variant="outline" className="capitalize">
              {brand.genre_focus.replace("_", " ")}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Genre Focus</p>
          </CardContent>
        </Card>
      </div>

      {/* Design Form */}
      <ClothingDesignForm
        scores={scores}
        onSubmit={(data) => createItem.mutate({ ...data, scores })}
        isSubmitting={createItem.isPending}
      />

      {/* My Items */}
      {items.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Your Collection ({items.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((item) => (
              <ClothingItemCard key={item.id} item={item as never} isOwn />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClothingDesigner;
