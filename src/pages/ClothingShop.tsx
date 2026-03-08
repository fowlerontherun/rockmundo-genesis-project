import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShoppingBag, Search, Filter } from "lucide-react";
import { useClothingMarketplace } from "@/hooks/useClothingMarketplace";
import { ClothingItemCard } from "@/components/clothing/ClothingItemCard";
import { CLOTHING_CATEGORIES, GENRE_STYLES, CATEGORY_EMOJIS, type ClothingCategory } from "@/utils/clothingQuality";

const ClothingShop = () => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [genre, setGenre] = useState<string>("all");

  const { listings, loading, purchaseItem } = useClothingMarketplace({
    category: category === "all" ? undefined : category,
    genre: genre === "all" ? undefined : genre,
    search: search || undefined,
  });

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="h-6 w-6" />
          Clothing Shop
        </h1>
        <p className="text-muted-foreground text-sm">Browse and buy player-designed clothing</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[140px] h-8">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CLOTHING_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_EMOJIS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="Genre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genres</SelectItem>
              {GENRE_STYLES.map((g) => (
                <SelectItem key={g} value={g}>
                  {g.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Loading marketplace...</p>
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No items found. Be the first to list clothing!</p>
            <Button variant="outline" className="mt-3" onClick={() => window.location.href = "/clothing-designer"}>
              Open Designer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {listings.map((item) => (
            <ClothingItemCard
              key={item.id}
              item={item}
              onPurchase={() => purchaseItem.mutate(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ClothingShop;
